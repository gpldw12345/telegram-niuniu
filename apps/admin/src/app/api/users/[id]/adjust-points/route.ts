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
  const amount = Number(formData.get("amount"));
  const direction = formData.get("direction") === "deduct" ? -1 : 1;
  const note = String(formData.get("note") || "");

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/users/${id}/adjust-points`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ amount: amount * direction, note })
  });

  if (!response.ok) {
    return NextResponse.redirect(new URL("/users?adjust=failed", request.headers.get("referer") || request.url), 303);
  }

  return redirectBackToDashboard(request);
}
