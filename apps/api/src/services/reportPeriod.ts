import { prisma } from "../config/db.js";

const reportPeriodStartKey = "reportPeriodStart";
const previousReportPeriodStartKey = "previousReportPeriodStart";

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
  const current = await getReportPeriodStart();
  await prisma.appSetting.upsert({
    where: {
      key: previousReportPeriodStartKey
    },
    create: {
      key: previousReportPeriodStartKey,
      value: current?.toISOString() ?? ""
    },
    update: {
      value: current?.toISOString() ?? ""
    }
  });

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

export async function revokeReportPeriodStart() {
  const previous = await prisma.appSetting.findUnique({
    where: {
      key: previousReportPeriodStartKey
    }
  });

  if (!previous) {
    return null;
  }

  if (!previous.value) {
    await prisma.appSetting.deleteMany({
      where: {
        key: reportPeriodStartKey
      }
    });
    return null;
  }

  const date = new Date(previous.value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  await prisma.appSetting.upsert({
    where: {
      key: reportPeriodStartKey
    },
    create: {
      key: reportPeriodStartKey,
      value: date.toISOString()
    },
    update: {
      value: date.toISOString()
    }
  });

  return date;
}
