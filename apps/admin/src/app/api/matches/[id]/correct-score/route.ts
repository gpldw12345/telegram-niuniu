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
  const odds: Record<string, number> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("odds_")) {
      continue;
    }

    const scoreKey = key.slice("odds_".length);
    const odd = Number(value);

    if (Number.isFinite(odd) && odd > 0) {
      odds[scoreKey] = odd;
    }
  }

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/matches/${id}/correct-score`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ odds })
  });

  if (!response.ok) {
    return NextResponse.redirect(new URL(`/matches/${id}/correct-score?save=failed`, request.url), 303);
  }

  return redirectBackToDashboard(request);
}
