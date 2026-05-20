import { redirectBackToDashboard } from "../redirect";

export async function POST(request: Request) {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const formData = await request.formData();
  const rawValue = String(formData.get("reportPeriodStart") || "");
  const reportPeriodStart = rawValue ? new Date(`${rawValue}:00+08:00`).toISOString() : "";

  await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/report-period`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ reportPeriodStart })
  });

  return redirectBackToDashboard(request);
}
