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

export function formatSignedPoints(amount: number) {
  return `${amount >= 0 ? "+" : ""}${Math.round(amount).toLocaleString()} points`;
}
