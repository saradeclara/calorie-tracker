/**
 * Garmin Connect Personal API (official, read-only, your own data).
 * Key: Garmin Connect Web → Personal API Key → Create. Store it as GARMIN_PERSONAL_API_KEY in Vercel.
 * The key is exchanged for a short-lived bearer token (a JWT), cached per server instance.
 */

const BASE = (process.env.GARMIN_PERSONAL_API_BASE_URL || "https://personal.connectapi.garmin.com").replace(/\/$/, "");
const TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token";

export class GarminError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export const garminConfigured = () => !!process.env.GARMIN_PERSONAL_API_KEY?.trim();

let cached: { token: string; expiresAt: number } | null = null;

function jwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {}
  return Date.now() + 50 * 60 * 1000; // unknown: assume ~an hour, refresh a bit early
}

async function token(force = false): Promise<string> {
  if (!force && cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) return cached.token;
  const res = await fetch(BASE + TOKEN_PATH, {
    method: "POST",
    headers: { Accept: "*/*", Authorization: `ApiKey ${process.env.GARMIN_PERSONAL_API_KEY!.trim()}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401 || res.status === 403) {
    throw new GarminError("Garmin rejected the API key. It may have expired: create a new one in Garmin Connect and update GARMIN_PERSONAL_API_KEY in Vercel.", 401);
  }
  if (!res.ok) throw new GarminError(`Garmin sign-in failed (${res.status}).`);
  const t = (await res.text()).trim().replace(/^"|"$/g, "");
  cached = { token: t, expiresAt: jwtExpiry(t) };
  return t;
}

export async function garminGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const url = `${BASE}${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  for (const retry of [false, true]) {
    const res = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${await token(retry)}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 && !retry) continue; // token revoked/expired early: get a fresh one once
    if (res.status === 204) return null as T;
    if (!res.ok) throw new GarminError(`Garmin request failed (${res.status}).`);
    return (await res.json()) as T;
  }
  throw new GarminError("Garmin request failed.");
}
