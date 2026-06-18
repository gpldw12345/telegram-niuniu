import type { FastifyBaseLogger } from "fastify";
import type { Telegraf } from "telegraf";
import { env } from "../config/env.js";
import { isAutoMatchSyncEnabled } from "../services/autoSyncSettings.js";
import { isAutoMatchPostEnabled } from "../services/autoPostSettings.js";
import { postEnabledMatchesToGroup } from "../services/groupPosting.js";
import { syncConfiguredMatches } from "../services/matchSync.js";

export function startAutoMatchSync(log: FastifyBaseLogger, bot?: Telegraf) {
  let isSyncing = false;
  const intervalMs = env.AUTO_SYNC_MATCHES_INTERVAL_MINUTES * 60 * 1000;

  const runSync = async () => {
    if (!(await isAutoMatchSyncEnabled())) {
      log.info("Auto match sync skipped because it is disabled");
      return;
    }

    if (isSyncing) {
      log.warn("Auto match sync skipped because previous sync is still running");
      return;
    }

    isSyncing = true;

    try {
      const result = await syncConfiguredMatches();
      const autoPostEnabled = await isAutoMatchPostEnabled();

      if (autoPostEnabled && bot) {
        const postResult = await postEnabledMatchesToGroup(bot, result.events, { onlyUnposted: true });
        log.info(
          {
            posted: postResult.posted,
            skipped: postResult.skipped,
            reason: postResult.reason
          },
          "Auto match post completed"
        );
      }

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
