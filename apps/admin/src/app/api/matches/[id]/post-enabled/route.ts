import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const formData = await request.formData();
  const { id } = await context.params;
  const enabled = formData.get("enabled") === "true";

  await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/matches/${id}/post-enabled`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ enabled })
  });

  return NextResponse.redirect(new URL("/", request.url), 303);
}
