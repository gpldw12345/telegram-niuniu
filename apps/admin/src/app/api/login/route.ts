import { NextResponse } from "next/server";
import { adminCookieName, createAdminToken, isValidAdminLogin } from "../../../auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const id = String(formData.get("id") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");

  if (!isValidAdminLogin(id, password)) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", request.url), 303);
  response.cookies.set(adminCookieName, await createAdminToken(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60
  });
  return response;
}
