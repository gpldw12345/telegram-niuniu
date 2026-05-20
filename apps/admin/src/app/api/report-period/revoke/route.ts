import { redirectBackToDashboard } from "../../redirect";

export async function POST(request: Request) {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";

  await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/report-period/revoke`, {
    method: "POST"
  });

  return redirectBackToDashboard(request);
}
