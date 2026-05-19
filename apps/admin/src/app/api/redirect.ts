import { NextResponse } from "next/server";

export function redirectBackToDashboard(request: Request) {
  const referer = request.headers.get("referer");

  if (referer) {
    return NextResponse.redirect(new URL("/", referer), 303);
  }

  return NextResponse.redirect(new URL("/", request.url), 303);
}
