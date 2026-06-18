import { Markup, type Telegraf } from "telegraf";
import { env } from "../config/env.js";
import { prisma } from "../config/db.js";
import { formatOddsApiGroupMatchPost } from "../bot/messages.js";
import { getPostEnabledMatches } from "./matchSync.js";
import type { OddsApiEvent } from "./oddsApi.js";

export async function postEnabledMatchesToGroup(
  bot: Telegraf,
  events: OddsApiEvent[],
  options: { onlyUnposted?: boolean } = {}
) {
  if (!env.TELEGRAM_GROUP_CHAT_ID) {
    return {
      posted: 0,
      skipped: 0,
      reason: "TELEGRAM_GROUP_CHAT_ID is not set"
    };
  }

  const eventById = new Map(events.map((event) => [event.id, event]));
  const enabledMatches = await getPostEnabledMatches();
  let posted = 0;
  let skipped = 0;

  for (const match of enabledMatches) {
    if (
      options.onlyUnposted &&
      match.preMatchMessageId &&
      match.groupChatId === String(env.TELEGRAM_GROUP_CHAT_ID)
    ) {
      skipped += 1;
      continue;
    }

    const event = eventById.get(match.oddsApiEventId);

    if (!event) {
      skipped += 1;
      continue;
    }

    const message = await bot.telegram.sendMessage(env.TELEGRAM_GROUP_CHAT_ID, formatOddsApiGroupMatchPost(event), {
      reply_markup: Markup.inlineKeyboard([
        Markup.button.url("Place Bet", `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=bet_${event.id}`)
      ]).reply_markup
    });

    await prisma.match.update({
      where: {
        id: match.id
      },
      data: {
        groupChatId: String(env.TELEGRAM_GROUP_CHAT_ID),
        preMatchMessageId: String(message.message_id)
      }
    });

    posted += 1;
  }

  return {
    posted,
    skipped,
    reason: null
  };
}
