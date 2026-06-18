import type { FastifyBaseLogger } from "fastify";
import { env } from "../config/env.js";
import { syncConfiguredMatches } from "../services/matchSync.js";

export function startAutoMatchSync(log: FastifyBaseLogger) {
  if (!env.AUTO_SYNC_MATCHES_ENABLED) {
    log.info("Auto match sync disabled");
    return null;
  }

  let isSyncing = false;
  const intervalMs = env.AUTO_SYNC_MATCHES_INTERVAL_MINUTES * 60 * 1000;

  const runSync = async () => {
    if (isSyncing) {
      log.warn("Auto match sync skipped because previous sync is still running");
      return;
    }

    isSyncing = true;

    try {
      const result = await syncConfiguredMatches();
      log.info(
        {
          provider: result.provider,
          synced: result.synced,
          errors: result.errors
        },
        "Auto match sync completed"
      );
    } catch (error) {
      log.error({ error }, "Auto match sync failed");
    } finally {
      isSyncing = false;
    }
  };

  const timer = setInterval(() => {
    void runSync();
  }, intervalMs);

  void runSync();
  log.info({ intervalMinutes: env.AUTO_SYNC_MATCHES_INTERVAL_MINUTES }, "Auto match sync started");

  return timer;
}
