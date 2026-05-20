import { NextResponse } from "next/server";
import { getPublicUrl } from "./url";

export function redirectBackToDashboard(request: Request) {
  const referer = request.headers.get("referer");

  if (referer && !referer.includes("localhost")) {
    return NextResponse.redirect(new URL("/", referer), 303);
  }

  return NextResponse.redirect(getPublicUrl(request, "/"), 303);
}
