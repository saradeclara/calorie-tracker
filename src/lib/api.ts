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
}): Promise<AiEstimate> {
  const passcode = await getSetting<string>("passcode", "");
  let res: Response;
  try {
    res = await fetch("/api/estimate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-app-passcode": passcode },
    body: JSON.stringify(input),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.");
  }
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}
