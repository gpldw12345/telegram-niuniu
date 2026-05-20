import { NextResponse } from "next/server";
import { adminCookieName } from "../../../auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.delete(adminCookieName);
  return response;
}
