import { Markup, Telegraf, type Context } from "telegraf";
import { env } from "../config/env.js";
import { formatOddsApiGroupMatchPost } from "./messages.js";
import { getPostEnabledMatches, syncConfiguredMatches } from "../services/matchSync.js";
import { getConfiguredOddsForSports, getConfiguredSportKeys } from "../services/oddsProvider.js";
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
import { getTelegramUserBalance } from "../services/users.js";

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
    await ctx.reply(
      [
        "World Cup Niuniu status",
        "",
        `Odds provider: ${env.ODDS_PROVIDER}`,
        `Sports: ${getConfiguredSportKeys().join(", ")}`,
        `Bookmaker: ${env.ODDS_API_BOOKMAKERS || "region default"}`,
        "Betting flow: 1X2 and Asian Handicap test mode"
      ].join("\n")
    );
  });

  bot.command("postmatches", async (ctx) => {
    if (!env.TELEGRAM_GROUP_CHAT_ID) {
      await ctx.reply("TELEGRAM_GROUP_CHAT_ID is not set yet.");
      return;
    }

    await ctx.reply("Syncing upcoming odds...");

    const { errors, events, provider } = await syncConfiguredMatches();
    const eventById = new Map(events.map((event) => [event.id, event]));
    const enabledMatches = await getPostEnabledMatches();
    const upcomingEvents = enabledMatches.flatMap((match) => {
      const event = eventById.get(match.oddsApiEventId);
      return event ? [event] : [];
    });

    if (upcomingEvents.length === 0) {
      await ctx.reply(
        [
          `No admin-selected matches found from ${provider}.`,
          "Open the admin dashboard, sync matches, then enable the matches you want to post.",
          errors.length > 0 ? `Sync warnings: ${errors.join(" | ")}` : ""
        ]
          .filter(Boolean)
          .join("\n")
      );
      return;
    }

    for (const event of upcomingEvents) {
      await ctx.telegram.sendMessage(env.TELEGRAM_GROUP_CHAT_ID, formatOddsApiGroupMatchPost(event), {
        reply_markup: Markup.inlineKeyboard([
          Markup.button.url(
            "Place Bet",
            `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=bet_${event.id}`
          )
        ]).reply_markup
      });
    }

    await ctx.reply(
      [
        `Posted ${upcomingEvents.length} admin-selected matches to the group.`,
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

    await ctx.reply(`${formatBetSlip(updated)}\n\nPlease type bet amount, for example 88.`);
  });

  bot.on("text", async (ctx, next) => {
    if (!isAwaitingStake(ctx.from.id)) {
      await next();
      return;
    }

    const stake = Number(ctx.message.text.trim());

    if (!Number.isFinite(stake) || stake <= 0 || !Number.isInteger(stake)) {
      await ctx.reply("Please enter a whole number bet amount, for example 88.");
      return;
    }

    const pending = setPendingStake(ctx.from.id, stake);

    if (!pending) {
      await ctx.reply("Please choose a selection first.");
      return;
    }

    const balance = await getTelegramUserBalance(ctx.from);

    await ctx.reply(
      `${formatBetSlip(pending, { currentBalance: balance.toNumber() })}\n\nConfirm bet?`,
      confirmKeyboard()
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

  await ctx.reply([title, formatUserStats(stats), "", ...bets.map(formatBetHistoryLine)].join("\n\n"));
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
