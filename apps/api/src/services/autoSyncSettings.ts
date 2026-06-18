import { env } from "../config/env.js";
import { prisma } from "../config/db.js";

const autoSyncMatchesEnabledKey = "autoSyncMatchesEnabled";

export async function isAutoMatchSyncEnabled() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: autoSyncMatchesEnabledKey
    }
  });

  if (!setting) {
    return env.AUTO_SYNC_MATCHES_ENABLED;
  }

  return setting.value === "true";
}

export async function setAutoMatchSyncEnabled(enabled: boolean) {
  await prisma.appSetting.upsert({
    where: {
      key: autoSyncMatchesEnabledKey
    },
    create: {
      key: autoSyncMatchesEnabledKey,
      value: String(enabled)
    },
    update: {
      value: String(enabled)
    }
  });

  return enabled;
}
