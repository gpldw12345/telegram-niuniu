import { Telegraf } from "telegraf";
import { env } from "../config/env.js";

const bot = env.TELEGRAM_BOT_TOKEN ? new Telegraf(env.TELEGRAM_BOT_TOKEN) : null;

export async function notifyTelegramUser(telegramId: string, message: string) {
  if (!bot) {
    return;
  }

  try {
    await bot.telegram.sendMessage(telegramId, message);
  } catch {
    // User may not have started the bot or may have blocked it.
  }
}

export async function notifyBetLogGroup(message: string) {
  if (!bot || !env.TELEGRAM_BET_LOG_CHAT_ID) {
    return;
  }

  try {
    await bot.telegram.sendMessage(env.TELEGRAM_BET_LOG_CHAT_ID, message);
  } catch {
    // Group may not be configured or bot may not have access.
  }
}

export function formatSignedPoints(amount: number) {
  const prefix = amount >= 0 ? "+RM" : "-RM";
  return `${prefix}${Math.round(Math.abs(amount))}`;
}
