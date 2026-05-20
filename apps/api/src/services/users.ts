import type { User } from "telegraf/types";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";

const STARTING_POINTS = new Prisma.Decimal(1000);
const DEFAULT_MAX_BET_AMOUNT = new Prisma.Decimal(1000);

export async function ensureTelegramUser(from: User) {
  const displayName = [from.first_name, from.last_name].filter(Boolean).join(" ");

  return prisma.telegramUser.upsert({
    where: {
      telegramId: String(from.id)
    },
    create: {
      telegramId: String(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      displayName,
      pointsBalance: STARTING_POINTS,
      maxBetAmount: DEFAULT_MAX_BET_AMOUNT,
      transactions: {
        create: {
          amount: STARTING_POINTS,
          balanceAfter: STARTING_POINTS,
          type: "CREDIT",
          source: "SYSTEM",
          note: "Starting RM balance"
        }
      }
    },
    update: {
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      displayName
    }
  });
}

export async function getTelegramUserBalance(from: User) {
  const user = await ensureTelegramUser(from);

  return user.pointsBalance;
}

export async function getTelegramUserBetLimits(from: User) {
  const user = await ensureTelegramUser(from);

  return {
    balance: user.pointsBalance,
    maxBetAmount: user.maxBetAmount
  };
}
