import { NextResponse } from "next/server";
import { adminCookieName } from "../../../auth";
import { getPublicUrl } from "../url";

export async function POST(request: Request) {
  const response = NextResponse.redirect(getPublicUrl(request, "/login"), 303);
  response.cookies.delete(adminCookieName);
  return response;
}
