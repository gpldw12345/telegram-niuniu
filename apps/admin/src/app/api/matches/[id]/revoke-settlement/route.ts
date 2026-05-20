import { NextResponse } from "next/server";
import { redirectBackToDashboard } from "../../../redirect";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const { id } = await context.params;
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/matches/${id}/revoke-settlement`, {
    method: "POST"
  });

  if (!response.ok) {
    return NextResponse.redirect(new URL("/matches?revoke=failed", request.headers.get("referer") || request.url), 303);
  }

  return redirectBackToDashboard(request);
}
