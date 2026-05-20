export function getPublicUrl(request: Request, pathname = "/") {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const host = forwardedHost || request.headers.get("host");

  if (host) {
    return new URL(pathname, `${forwardedProto}://${host}`);
  }

  return new URL(pathname, request.url);
}

export function getSafePath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
