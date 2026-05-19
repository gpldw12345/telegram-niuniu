import { NextResponse } from "next/server";
import { redirectBackToDashboard } from "../../../redirect";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const formData = await request.formData();
  const { id } = await context.params;
  const homeScore = Number(formData.get("homeScore"));
  const awayScore = Number(formData.get("awayScore"));

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/matches/${id}/settle`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ homeScore, awayScore })
  });

  if (!response.ok) {
    return NextResponse.redirect(new URL("/?settle=failed", request.headers.get("referer") || request.url), 303);
  }

  return redirectBackToDashboard(request);
}
