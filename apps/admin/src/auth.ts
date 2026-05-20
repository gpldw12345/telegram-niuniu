export const adminCookieName = "niuniu_admin_session";

const users = [
  { id: "hwhw0780", password: "fp7210780" },
  { id: "pkepke", password: "Aaaa1234" }
];

export function isValidAdminLogin(id: string, password: string) {
  return users.some((user) => user.id === id && user.password === password);
}

export async function createAdminToken(id: string) {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const payload = base64UrlEncode(JSON.stringify({ id, expiresAt }));
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

export async function verifyAdminToken(token: string | undefined) {
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || (await sign(payload)) !== signature) {
    return false;
  }

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as { expiresAt?: number };
    return typeof data.expiresAt === "number" && data.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function getSecret() {
  return process.env.ADMIN_JWT_SECRET || "telegram-niuniu-admin-local-secret-change-me";
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
