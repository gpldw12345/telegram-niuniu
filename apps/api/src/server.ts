import Fastify from "fastify";
import type { Telegraf } from "telegraf";
import type { Update } from "telegraf/types";
import { env, isProduction } from "./config/env.js";
import { registerHealthRoutes } from "./routes/health.js";

export async function createServer(bot?: Telegraf) {
  const app = Fastify({
    logger: {
      level: isProduction ? "info" : "debug",
      transport: isProduction ? undefined : { target: "pino-pretty" }
    }
  });

  await registerHealthRoutes(app);

  app.get("/", async () => ({
    name: "telegram-niuniu-api",
    adminSiteUrl: env.ADMIN_SITE_URL
  }));

  if (bot) {
    app.post("/telegram/webhook", async (request) => {
      await bot.handleUpdate(request.body as Update);
      return { ok: true };
    });
  }

  return app;
}
