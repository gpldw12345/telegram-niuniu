import { env } from "../config/env.js";
import { prisma } from "../config/db.js";

const autoPostMatchesEnabledKey = "autoPostMatchesEnabled";

export async function isAutoMatchPostEnabled() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: autoPostMatchesEnabledKey
    }
  });

  if (!setting) {
    return env.AUTO_POST_MATCHES_ENABLED;
  }

  return setting.value === "true";
}

export async function setAutoMatchPostEnabled(enabled: boolean) {
  await prisma.appSetting.upsert({
    where: {
      key: autoPostMatchesEnabledKey
    },
    create: {
      key: autoPostMatchesEnabledKey,
      value: String(enabled)
    },
    update: {
      value: String(enabled)
    }
  });

  return enabled;
}
