import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, "../../../../.env") });
config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_GROUP_CHAT_ID: z.string().optional(),
  TELEGRAM_BET_LOG_CHAT_ID: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  ODDS_PROVIDER: z.enum(["mock", "odds-api"]).default("mock"),
  ODDS_API_KEY: z.string().optional(),
  ODDS_API_SPORT_KEY: z.string().default("soccer_fifa_world_cup"),
  ODDS_API_SPORT_KEYS: z.string().optional(),
  ODDS_API_REGIONS: z.string().default("eu"),
  ODDS_API_BOOKMAKERS: z.string().optional(),
  AUTO_SYNC_MATCHES_ENABLED: z.coerce.boolean().default(true),
  AUTO_SYNC_MATCHES_INTERVAL_MINUTES: z.coerce.number().int().positive().default(30),
  AUTO_POST_MATCHES_ENABLED: z.coerce.boolean().default(false),
  ADMIN_JWT_SECRET: z.string().min(24).optional(),
  ADMIN_SITE_URL: z.string().url().default("http://localhost:3000"),
  API_BASE_URL: z.string().url().default("http://localhost:4000")
});

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === "production";
