import { prisma } from "../config/db.js";

const reportPeriodStartKey = "reportPeriodStart";

export async function getReportPeriodStart() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: reportPeriodStartKey
    }
  });

  if (!setting) {
    return null;
  }

  const date = new Date(setting.value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function setReportPeriodStart(value: Date) {
  return prisma.appSetting.upsert({
    where: {
      key: reportPeriodStartKey
    },
    create: {
      key: reportPeriodStartKey,
      value: value.toISOString()
    },
    update: {
      value: value.toISOString()
    }
  });
}
