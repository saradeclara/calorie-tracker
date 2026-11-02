import { getSetting } from "./db";
import type { AiEstimate, GarminBurn, GarminDay, MealIdea, Product } from "./types";

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

/** POST to one of our AI routes with the passcode, and never hang forever. */
async function postAi<T>(path: string, body: unknown): Promise<T> {
  const passcode = await getSetting<string>("passcode", "");
  let res: Response;
  // Give up a little after the server's own limit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65_000);
  try {
    res = await fetch(path, {
      signal: controller.signal,
      method: "POST",
      headers: { "content-type": "application/json", "x-app-passcode": passcode },
      body: JSON.stringify(body),
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

export function estimateFood(input: { description: string; image?: string /* data URL */ }) {
  return postAi<AiEstimate>("/api/estimate", input);
}

export function suggestMeals(prompt: string) {
  return postAi<{ ideas: MealIdea[] }>("/api/suggest", { prompt });
}

export async function getGarminDay(date: string): Promise<GarminDay> {
  const passcode = await getSetting<string>("passcode", "");
  let res: Response;
  try {
    res = await fetch(`/api/garmin/day?date=${date}`, {
      headers: { "x-app-passcode": passcode },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error("Couldn't reach Garmin. Check your connection.");
  }
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function getGarminBurn(end: string, days = 28): Promise<GarminBurn> {
  const passcode = await getSetting<string>("passcode", "");
  let res: Response;
  try {
    res = await fetch(`/api/garmin/burn?end=${end}&days=${days}`, {
      headers: { "x-app-passcode": passcode },
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new Error("Couldn't reach Garmin. Check your connection.");
  }
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export interface PlanResponse {
  message: string;
  plan: import("./plan").MealPlan;
  check: { totals: import("./types").Nutrients; min: number; max: number; within: boolean; problem: string | null };
  attempts: number;
}

export function requestPlan(body: {
  dayLabel: string;
  targets: import("./plan").PlanTargets;
  messages: { role: "user" | "assistant"; content: string }[];
  plan?: import("./plan").MealPlan | null;
  triggers?: string[];
  kits?: import("./plan").PlanKit[];
}) {
  return postAi<PlanResponse>("/api/plan", body);
}

export function readRecipeCard(image: string) {
  return postAi<import("./types").RecipeCard>("/api/recipe-card", { image });
}
