import { db, getGoals, getSetting, logEntries, setSetting } from "./db";
import { fromKey, todayKey, addDays } from "./dates";
import type { PlanResponse } from "./api";
import type { MealPlan, PlanTargets } from "./plan";
import type { Profile } from "./deficit";

export interface PlanTurn {
  role: "user" | "assistant";
  content: string;
  at: number;
}

/** The one active plan, kept on the device. */
export interface StoredPlan {
  date: string;
  plan: MealPlan;
  check: PlanResponse["check"];
  chat: PlanTurn[];
  loggedAt?: number;
}

export const PLAN_KEY = "mealPlan";

export const planTurn = (role: PlanTurn["role"], content: string): PlanTurn => ({ role, content, at: Date.now() });

/** Your calorie goal (from Goals & settings) + macro targets + safe floor. */
export async function planTargets(): Promise<PlanTargets> {
  const [g, profile] = await Promise.all([getGoals(), getSetting<Partial<Profile> | null>("deficitProfile", null)]);
  return {
    kcal: g.kcal,
    protein: g.protein,
    carbs: g.carbs,
    fat: g.fat,
    fibre: g.fibre,
    floor: profile?.sex === "male" ? 1500 : 1200,
  };
}

/** Trigger names for the AI, only if the user opted in to sharing. */
export async function sharedTriggers(): Promise<string[]> {
  if (!(await getSetting<boolean>("coachShareReflux", false))) return [];
  return (await db.foods.toArray()).filter((f) => f.trigger).map((f) => f.name);
}

export function dayLabel(date: string): string {
  const base = fromKey(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const t = todayKey();
  return date === t ? `${base} (today)` : date === addDays(t, 1) ? `${base} (tomorrow)` : base;
}

export function savePlan(p: StoredPlan | null) {
  return setSetting(PLAN_KEY, p);
}

/** Add every planned item to that day's log. */
export async function logPlan(p: StoredPlan) {
  await logEntries(
    p.plan.meals.flatMap((m) =>
      m.items.map((i) => ({
        name: i.name,
        portion: i.portion,
        kcal: i.kcal,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
        fibre: i.fibre,
        source: "ai" as const,
        date: p.date,
        meal: m.meal,
      })),
    ),
  );
  await savePlan({ ...p, loggedAt: Date.now() });
}
