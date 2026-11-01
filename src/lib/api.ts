import { getSetting } from "./db";
import type { AiEstimate, Product } from "./types";

async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text);
    if (body?.error) return typeof body.error === "string" ? body.error : JSON.stringify(body.error);
  } catch {}
  if (res.status === 504) return "The AI took too long to respond (server timeout). Try again.";
  if (res.status === 413) return "That photo is too large. Try a smaller one.";
  return `Request failed (${res.status})${text ? `: ${text.slice(0, 160)}` : ""}`;
}

export async function lookupBarcode(code: string): Promise<Product | null> {
  const res = await fetch(`/api/barcode/${encodeURIComponent(code)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function estimateFood(input: {
  description: string;
  image?: string; // data URL
  /** Names of your known reflux triggers, so the AI can reuse them */
  triggers?: string[];
}): Promise<AiEstimate> {
  const passcode = await getSetting<string>("passcode", "");
  let res: Response;
  // Never leave the UI spinning: give up a little after the server's own limit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 125_000);
  try {
    res = await fetch("/api/estimate", {
      signal: controller.signal,
    method: "POST",
    headers: { "content-type": "application/json", "x-app-passcode": passcode },
    body: JSON.stringify(input),
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error)?.name === "AbortError") {
      throw new Error("The AI took too long to respond. Try again.");
    }
    throw new Error("Couldn't reach the server. Check your connection.");
  }
  clearTimeout(timer);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}
