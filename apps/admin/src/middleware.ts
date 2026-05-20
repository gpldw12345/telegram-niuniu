import { NextResponse, type NextRequest } from "next/server";
import { adminCookieName, verifyAdminToken } from "./auth";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const isAuthed = await verifyAdminToken(request.cookies.get(adminCookieName)?.value);

  if (!isAuthed) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
