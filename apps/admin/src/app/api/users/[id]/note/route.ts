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
  const note = String(formData.get("note") || "");
  const maxBetAmount = Number(formData.get("maxBetAmount") || 1000);

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/users/${id}/note`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ note, maxBetAmount })
  });

  if (!response.ok) {
    return NextResponse.redirect(new URL("/users?note=failed", request.headers.get("referer") || request.url), 303);
  }

  return redirectBackToDashboard(request);
}
