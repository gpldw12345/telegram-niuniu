import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";

  await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/sync-matches`, {
    method: "POST"
  });

  return NextResponse.redirect(new URL("/", request.url), 303);
}
