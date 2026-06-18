import { Markup, Telegraf, type Context } from "telegraf";
import { env } from "../config/env.js";
import { syncConfiguredMatches } from "../services/matchSync.js";
import { getConfiguredOddsForSports, getConfiguredSportKeys } from "../services/oddsProvider.js";
import { isAutoMatchSyncEnabled, setAutoMatchSyncEnabled } from "../services/autoSyncSettings.js";
import { isAutoMatchPostEnabled, setAutoMatchPostEnabled } from "../services/autoPostSettings.js";
import { postEnabledMatchesToGroup } from "../services/groupPosting.js";
import {
  beginBet,
  cancelPendingBet,
  confirmKeyboard,
  confirmPendingBet,
  formatBetHeader,
  formatBetSlip,
  getPendingBet,
  getSelections,
  marketKeyboard,
  selectionKeyboard,
  setPendingSelection,
  setPendingStake,
  isAwaitingStake
} from "./betFlow.js";
import { displayTeamName } from "./teamNames.js";
import { correctScoreRows, getCorrectScoreSelections } from "../services/correctScore.js";
import { type BetHistoryFilter, getUserBetHistory, InsufficientPointsError, placeConfirmedBet } from "../services/bets.js";
import { getTelegramUserBalance, getTelegramUserBetLimits } from "../services/users.js";

const MIN_BET_AMOUNT = 15;

export function createTelegramBot() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return null;
  }

  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  bot.start(async (ctx) => {
    const payload = ctx.payload;

    if (payload?.startsWith("bet_")) {
      const eventId = payload.slice("bet_".length);
      const { events } = await getConfiguredOddsForSports();
      const event = events.find((candidate) => candidate.id === eventId);

      if (!event) {
        await ctx.reply("This match is no longer available. Please use the latest group message.");
        return;
      }

      beginBet(ctx.from.id, event);
      await ctx.reply([formatBetHeader(event), "", "Choose market:"].join("\n"), marketKeyboard(event));
      return;
    }

    await ctx.reply(
      "Welcome to World Cup Niuniu.\n\nUse the group match buttons to place bets.",
      Markup.keyboard([["Balance", "My Bets"]]).resize()
    );
  });

  bot.command("groupid", async (ctx) => {
    const chat = ctx.chat;

    if (!chat) {
      await ctx.reply("I could not read this chat.");
      return;
    }

    await ctx.reply(
      [
        "Group setup info",
        "",
        `Chat ID: ${chat.id}`,
        `Chat type: ${chat.type}`,
        "Send this chat ID to Codex so it can be saved as TELEGRAM_GROUP_CHAT_ID."
      ].join("\n")
    );
  });

  bot.command("status", async (ctx) => {
    const autoSyncEnabled = await isAutoMatchSyncEnabled();
    const autoPostEnabled = await isAutoMatchPostEnabled();

    await ctx.reply(
      [
        "World Cup Niuniu status",
        "",
        `Odds provider: ${env.ODDS_PROVIDER}`,
        `Sports: ${getConfiguredSportKeys().join(", ")}`,
        `Bookmaker: ${env.ODDS_API_BOOKMAKERS || "region default"}`,
        `Auto sync: ${autoSyncEnabled ? "ON" : "OFF"} / every ${env.AUTO_SYNC_MATCHES_INTERVAL_MINUTES} mins`,
        `Auto post: ${autoPostEnabled ? "ON" : "OFF"}`,
        "Betting flow: 1X2 and Asian Handicap test mode"
      ].join("\n")
    );
  });

  bot.command("autosync_on", async (ctx) => {
    if (!(await canManageAutoSync(ctx))) {
      return;
    }

    await setAutoMatchSyncEnabled(true);
    await ctx.reply(`Auto sync is ON. Matches will sync every ${env.AUTO_SYNC_MATCHES_INTERVAL_MINUTES} minutes.`);
  });

  bot.command("autosync_off", async (ctx) => {
    if (!(await canManageAutoSync(ctx))) {
      return;
    }

    await setAutoMatchSyncEnabled(false);
    await ctx.reply("Auto sync is OFF. You can still sync manually from admin or /postmatches.");
  });

  bot.command("autosync_status", async (ctx) => {
    if (!(await canManageAutoSync(ctx))) {
      return;
    }

    const enabled = await isAutoMatchSyncEnabled();
    await ctx.reply(`Auto sync: ${enabled ? "ON" : "OFF"}\nInterval: ${env.AUTO_SYNC_MATCHES_INTERVAL_MINUTES} minutes`);
  });

  bot.command("autopost_on", async (ctx) => {
    if (!(await canManageAutoSync(ctx))) {
      return;
    }

    await setAutoMatchPostEnabled(true);
    await ctx.reply("Auto post is ON. After each auto sync, admin-ticked unposted matches will be posted to the group.");
  });

  bot.command("autopost_off", async (ctx) => {
    if (!(await canManageAutoSync(ctx))) {
      return;
    }

    await setAutoMatchPostEnabled(false);
    await ctx.reply("Auto post is OFF. Auto sync can still update admin odds.");
  });

  bot.command("autopost_status", async (ctx) => {
    if (!(await canManageAutoSync(ctx))) {
      return;
    }

    const enabled = await isAutoMatchPostEnabled();
    await ctx.reply(`Auto post: ${enabled ? "ON" : "OFF"}`);
  });

  bot.command("postmatches", async (ctx) => {
    if (!env.TELEGRAM_GROUP_CHAT_ID) {
      await ctx.reply("TELEGRAM_GROUP_CHAT_ID is not set yet.");
      return;
    }

    await ctx.reply("Syncing upcoming odds...");

    const { errors, events, provider } = await syncConfiguredMatches();
    const postResult = await postEnabledMatchesToGroup(bot, events);

    if (postResult.posted === 0) {
      await ctx.reply(
        [
          `No admin-selected matches found from ${provider}.`,
          postResult.reason,
          "Open the admin dashboard, sync matches, then enable the matches you want to post.",
          errors.length > 0 ? `Sync warnings: ${errors.join(" | ")}` : ""
        ]
          .filter(Boolean)
          .join("\n")
      );
      return;
    }

    await ctx.reply(
      [
        `Posted ${postResult.posted} admin-selected matches to the group.`,
        postResult.skipped > 0 ? `Skipped ${postResult.skipped} matches.` : "",
        errors.length > 0 ? `Sync warnings: ${errors.join(" | ")}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    );
  });

  bot.hears("Balance", async (ctx) => {
    const balance = await getTelegramUserBalance(ctx.from);
    await ctx.reply(`Balance: ${formatMoney(balance.toNumber())}`);
  });

  bot.hears("My Bets", async (ctx) => {
    await ctx.reply("Choose bet list:", betHistoryKeyboard());
  });

  bot.action(/^bets:(running|upcoming|settled)$/, async (ctx) => {
    const filter = ctx.match[1] as BetHistoryFilter;
    await ctx.answerCbQuery();
    await sendBetHistory(ctx, filter);
  });

  bot.action(/^bet:market:(1x2|ah|ou|cs)$/, async (ctx) => {
    const market = ctx.match[1];
    const pending = getPendingBet(ctx.from.id);

    await ctx.answerCbQuery();

    if (market !== "1x2" && market !== "ah" && market !== "ou" && market !== "cs") {
      await ctx.reply("Unknown market.");
      return;
    }

    if (!pending) {
      await ctx.reply("Please start again from the group Place Bet button.");
      return;
    }

    if (market === "cs") {
      if (pending.event.sport_key.startsWith("basketball_")) {
        await ctx.reply("Correct Score is only available for soccer.");
        return;
      }

      const selections = await getCorrectScoreSelections(pending.event.id);

      if (selections.length === 0) {
        await ctx.reply("Correct Score odds are not available for this match yet.");
        return;
      }

      await ctx.reply(
        `Choose correct score:\n\n${formatBetHeader(pending.event)}`,
        Markup.inlineKeyboard(correctScoreKeyboardRows(selections))
      );
      return;
    }

    const keyboard = selectionKeyboard(pending.event, market);

    if (!keyboard) {
      await ctx.reply("No odds available for this market yet.");
      return;
    }

    await ctx.reply(`Choose selection:\n\n${formatBetHeader(pending.event)}`, keyboard);
  });

  bot.action(/^bet:selection:(1x2|ah|ou|cs):(\d+)$/, async (ctx) => {
    const market = ctx.match[1];
    const index = Number(ctx.match[2]);
    const pending = getPendingBet(ctx.from.id);

    await ctx.answerCbQuery();

    if (market !== "1x2" && market !== "ah" && market !== "ou" && market !== "cs") {
      await ctx.reply("Unknown market.");
      return;
    }

    if (!pending) {
      await ctx.reply("Please start again from the group Place Bet button.");
      return;
    }

    const selections =
      market === "cs"
        ? await getCorrectScoreSelections(pending.event.id)
        : getSelections(pending.event, market);
    const selection = selections[index];

    if (!selection) {
      await ctx.reply("This selection is no longer available. Please start again.");
      return;
    }

    const updated = setPendingSelection(ctx.from.id, selection);

    if (!updated) {
      await ctx.reply("Please start again from the group Place Bet button.");
      return;
    }

    const limits = await getTelegramUserBetLimits(ctx.from);

    await ctx.reply(
      [
        formatBetSlip(updated, {
          currentBalance: limits.balance.toNumber(),
          minBetAmount: MIN_BET_AMOUNT,
          maxBetAmount: limits.maxBetAmount.toNumber()
        }),
        "",
        "Please type bet amount, for example 88."
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });

  bot.on("text", async (ctx, next) => {
    if (!isAwaitingStake(ctx.from.id)) {
      await next();
      return;
    }

    const stake = Number(ctx.message.text.trim());

    const limits = await getTelegramUserBetLimits(ctx.from);
    const maxBetAmount = limits.maxBetAmount.toNumber();

    if (!Number.isFinite(stake) || stake <= 0 || !Number.isInteger(stake)) {
      await ctx.reply("Please enter a whole number bet amount, for example 88.");
      return;
    }

    if (stake < MIN_BET_AMOUNT) {
      await ctx.reply(`Minimum bet is ${formatMoney(MIN_BET_AMOUNT)}.`);
      return;
    }

    if (stake > maxBetAmount) {
      await ctx.reply(`Maximum bet for your account is ${formatMoney(maxBetAmount)}.`);
      return;
    }

    const pending = setPendingStake(ctx.from.id, stake);

    if (!pending) {
      await ctx.reply("Please choose a selection first.");
      return;
    }

    await ctx.reply(
      `${formatBetSlip(pending, {
        currentBalance: limits.balance.toNumber(),
        minBetAmount: MIN_BET_AMOUNT,
        maxBetAmount
      })}\n\nConfirm bet?`,
      { ...confirmKeyboard(), parse_mode: "Markdown" }
    );
  });

  bot.action("bet:confirm", async (ctx) => {
    const confirmed = confirmPendingBet(ctx.from.id);

    await ctx.answerCbQuery();

    if (!confirmed) {
      await ctx.reply("No complete bet slip to confirm.");
      return;
    }

    try {
      const placed = await placeConfirmedBet(ctx.from, confirmed);

      await ctx.reply(
        [
          "Bet confirmed",
          "",
          formatBetSlip(confirmed),
          "",
          `Balance after bet: RM${placed.balanceAfter.toFixed(0)}`
        ].join("\n")
      );

      if (env.TELEGRAM_BET_LOG_CHAT_ID) {
        await ctx.telegram
          .sendMessage(
            env.TELEGRAM_BET_LOG_CHAT_ID,
            [
              `${formatUserMention(ctx.from)} bet`,
              formatBetHeader(confirmed.event),
              confirmed.selection.label,
              `Bet: RM${confirmed.stake}`,
              `Balance: RM${placed.balanceAfter.toFixed(0)}`
            ].join("\n")
          )
          .catch(() => undefined);
      }
      return;
    } catch (error) {
      if (error instanceof InsufficientPointsError) {
        await ctx.reply("Not enough balance for this bet. Please choose a smaller amount.");
        return;
      }

      throw error;
    }
  });

  bot.action("bet:cancel", async (ctx) => {
    cancelPendingBet(ctx.from.id);
    await ctx.answerCbQuery();
    await ctx.reply("Bet cancelled. Use the group Place Bet button to start again.");
  });

  bot.command("cancel", async (ctx) => {
    cancelPendingBet(ctx.from.id);
    await ctx.reply("Bet cancelled. Use the group Place Bet button to start again.");
  });

  bot.command("balance", async (ctx) => {
    const balance = await getTelegramUserBalance(ctx.from);
    await ctx.reply(`Balance: ${formatMoney(balance.toNumber())}`);
  });

  bot.command("mybets", async (ctx) => {
    await ctx.reply("Choose bet list:", betHistoryKeyboard());
  });

  bot.command("history", async (ctx) => {
    await ctx.reply("Choose bet list:", betHistoryKeyboard());
  });

  bot.catch((error, ctx) => {
    ctx.telegram
      .sendMessage(ctx.chat?.id ?? 0, "Something went wrong. Please try again.")
      .catch(() => undefined);
    console.error("Telegram bot error", error);
  });

  return bot;
}

async function sendBetHistory(ctx: Context, filter: BetHistoryFilter) {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram user.");
    return;
  }

  const { bets, stats } = await getUserBetHistory(ctx.from, filter);
  const title = betHistoryTitle(filter);

  if (bets.length === 0) {
    await ctx.reply(`No ${title.toLowerCase()} bets.`);
    return;
  }

  const summary =
    filter === "settled"
      ? formatUserStats(stats)
      : formatOpenBetSummary(filter, bets.length, bets.reduce((total, bet) => total + bet.stake.toNumber(), 0));

  await ctx.reply([title, summary, "", ...bets.map(formatBetHistoryLine)].join("\n\n"));
}

function betHistoryKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Running", "bets:running"),
      Markup.button.callback("Upcoming", "bets:upcoming"),
      Markup.button.callback("Settled", "bets:settled")
    ]
  ]);
}

function betHistoryTitle(filter: BetHistoryFilter) {
  if (filter === "running") {
    return "Running Bets";
  }

  if (filter === "upcoming") {
    return "Upcoming Bets";
  }

  if (filter === "settled") {
    return "Settled Bets";
  }

  return "Bet History";
}

function formatUserStats(stats: {
  totalBets: number;
  pending: number;
  won: number;
  lost: number;
  pushed: number;
  totalStake: number;
  net: number;
}) {
  return [
    "Bet History",
    `W-L-P: ${formatStat(stats.won)}-${formatStat(stats.lost)}-${formatStat(stats.pushed)}`,
    `Pending: ${stats.pending}`,
    `Total bet: ${formatMoney(stats.totalStake)}`,
    `Net: ${formatSignedMoney(stats.net)}`
  ].join("\n");
}

function formatOpenBetSummary(filter: BetHistoryFilter, count: number, totalBet: number) {
  const label = filter === "running" ? "running" : "upcoming";
  const gameWord = count === 1 ? "game" : "games";

  return `You have ${count} ${label} ${gameWord} with total bet ${formatMoney(totalBet)}.`;
}

function formatBetHistoryLine(
  bet: Awaited<ReturnType<typeof getUserBetHistory>>["bets"][number],
  index: number
) {
  return `${index + 1}. ${displayTeamName(bet.match.homeTeam)} vs ${displayTeamName(bet.match.awayTeam)}
${formatKickoff(bet.match.commenceTime)}
${bet.selectionLabel}
Bet: ${formatMoney(bet.stake.toNumber())} | Odds: ${bet.odds.toFixed(2).replace(/\.00$/, "")}
Status: ${formatBetStatus(bet.status)}`;
}

function formatMoney(value: number) {
  return `${value < 0 ? "-" : ""}RM${Math.round(Math.abs(value))}`;
}

function formatSignedMoney(value: number) {
  return `${value >= 0 ? "+" : ""}${formatMoney(value)}`;
}

function formatKickoff(value: Date) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(value);
}

function formatBetStatus(status: string) {
  return status.replace(/_/g, " ");
}

async function canManageAutoSync(ctx: Context) {
  if (!env.TELEGRAM_GROUP_CHAT_ID) {
    await ctx.reply("TELEGRAM_GROUP_CHAT_ID is not set.");
    return false;
  }

  if (String(ctx.chat?.id) !== env.TELEGRAM_GROUP_CHAT_ID) {
    await ctx.reply("Please run this command in the configured admin/group chat.");
    return false;
  }

  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram user.");
    return false;
  }

  try {
    const member = await ctx.getChatMember(ctx.from.id);

    if (member.status === "creator" || member.status === "administrator") {
      return true;
    }
  } catch {
    await ctx.reply("I could not verify your group admin status.");
    return false;
  }

  await ctx.reply("Only group admins can change auto sync.");
  return false;
}

function correctScoreKeyboardRows(selections: Awaited<ReturnType<typeof getCorrectScoreSelections>>) {
  const indexByKey = new Map(selections.map((selection, index) => [selection.selectionKey, index]));
  const labelByKey = new Map(selections.map((selection) => [selection.selectionKey, selection.label]));

  return correctScoreRows().flatMap((row) => {
    const buttons = row.flatMap((score) => {
      if (!score) {
        return [];
      }

      const index = indexByKey.get(score.key);
      const label = labelByKey.get(score.key);

      if (index === undefined || !label) {
        return [];
      }

      return Markup.button.callback(label, `bet:selection:cs:${index}`);
    });

    return buttons.length > 0 ? [buttons] : [];
  });
}

function formatStat(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function formatUserMention(user: { username?: string; first_name?: string; last_name?: string }) {
  if (user.username) {
    return `@${user.username}`;
  }

  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "User";
}
