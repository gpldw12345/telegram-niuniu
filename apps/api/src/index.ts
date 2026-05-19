import { createTelegramBot } from "./bot/telegram.js";
import { env, isProduction } from "./config/env.js";
import { prisma } from "./config/db.js";
import { createServer } from "./server.js";

async function main() {
  const bot = createTelegramBot();
  const app = await createServer(bot ?? undefined);

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info({ port: env.PORT }, "API server started");

  if (bot) {
    if (isProduction) {
      void configureTelegramWebhook(bot, app.log);
    } else {
      bot
        .launch()
        .then(() => app.log.info("Telegram bot started"))
        .catch((error) => app.log.error({ error }, "Telegram bot failed to start"));
    }
  } else {
    app.log.warn("TELEGRAM_BOT_TOKEN is empty, bot is not started");
  }

  const shutdown = async () => {
    app.log.info("Shutting down");
    if (bot && !isProduction) {
      bot.stop("SIGTERM");
    }
    await prisma.$disconnect();
    await app.close();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

async function configureTelegramWebhook(bot: NonNullable<ReturnType<typeof createTelegramBot>>, log: Awaited<ReturnType<typeof createServer>>["log"]) {
  const webhookUrl = `${env.API_BASE_URL.replace(/\/$/, "")}/telegram/webhook`;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await bot.telegram.setWebhook(webhookUrl);
      log.info({ webhookUrl }, "Telegram webhook configured");
      return;
    } catch (error) {
      log.error({ error, attempt }, "Telegram webhook setup failed");
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
