import Fastify from "fastify";
import { env, isProduction } from "./config/env.js";
import { registerHealthRoutes } from "./routes/health.js";

export async function createServer() {
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

  return app;
}
