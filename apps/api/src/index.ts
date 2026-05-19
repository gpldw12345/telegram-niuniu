import { createTelegramBot } from "./bot/telegram.js";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { createServer } from "./server.js";

async function main() {
  const app = await createServer();
  const bot = createTelegramBot();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info({ port: env.PORT }, "API server started");

  if (bot) {
    bot
      .launch()
      .then(() => app.log.info("Telegram bot started"))
      .catch((error) => app.log.error({ error }, "Telegram bot failed to start"));
  } else {
    app.log.warn("TELEGRAM_BOT_TOKEN is empty, bot is not started");
  }

  const shutdown = async () => {
    app.log.info("Shutting down");
    bot?.stop("SIGTERM");
    await prisma.$disconnect();
    await app.close();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
