import { NextResponse } from "next/server";
import { adminCookieName, createAdminToken, isValidAdminLogin } from "../../../auth";
import { getPublicUrl, getSafePath } from "../url";

export async function POST(request: Request) {
  const formData = await request.formData();
  const id = String(formData.get("id") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");

  if (!isValidAdminLogin(id, password)) {
    return NextResponse.redirect(getPublicUrl(request, "/login?error=1"), 303);
  }

  const response = NextResponse.redirect(getPublicUrl(request, getSafePath(next)), 303);
  response.cookies.set(adminCookieName, await createAdminToken(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60
  });
  return response;
}
