import { getSetting } from "./db";
import type { AiEstimate, Product } from "./types";

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.error) return body.error;
  } catch {}
  return `Request failed (${res.status})`;
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
  const res = await fetch("/api/estimate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-app-passcode": passcode },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}
