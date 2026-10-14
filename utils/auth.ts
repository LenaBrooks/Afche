import { createHmac, timingSafeEqual } from "crypto";
import type { IncomingMessage } from "http";
import type { NextApiRequest, NextApiResponse } from "next";

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.CLOUDINARY_API_SECRET ||
    "dev-admin-secret"
  );
}

function getAdminCredentials() {
  return {
    user: process.env.ADMIN_USER || "admin",
    password: process.env.ADMIN_PASSWORD || "admin",
  };
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");
}

export function createSessionToken(username: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${username}:${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const expected = sign(payload);

  try {
    const a = new Uint8Array(Buffer.from(signature));
    const b = new Uint8Array(Buffer.from(expected));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }

  const [username, expRaw] = payload.split(":");
  const exp = Number(expRaw);
  if (!username || !Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;

  return username === getAdminCredentials().user;
}

export function parseCookies(cookieHeader: string | undefined) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getSessionFromRequest(
  req: IncomingMessage | NextApiRequest,
): string | undefined {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[ADMIN_COOKIE];
}

export function isAuthenticated(
  req: IncomingMessage | NextApiRequest,
): boolean {
  return verifySessionToken(getSessionFromRequest(req));
}

export function validateCredentials(username: string, password: string) {
  const creds = getAdminCredentials();
  return username === creds.user && password === creds.password;
}

export function setSessionCookie(res: NextApiResponse, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`,
  );
}

export function clearSessionCookie(res: NextApiResponse) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

export function requireAdminApi(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "نشست نامعتبر است. دوباره وارد شوید." });
    return false;
  }
  return true;
}
