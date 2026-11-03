import type { Meal, Nutrients, Recipe } from "./types";

export interface PlanItem extends Nutrients {
  name: string;
  portion?: string;
  /** Set when this item is one of the user's saved meal-kit recipes */
  kitId?: number;
  brand?: string;
}

/** A saved meal-kit recipe offered to the planner (per serving, from the card). */
export interface PlanKit extends Nutrients {
  id: number;
  name: string;
  brand?: string;
  /** The saved portion the numbers are for, e.g. "1 serving" or "1 × pack (400 g)" */
  portion?: string;
}

export interface PlanMeal {
  meal: Meal;
  title: string;
  method?: string;
  items: PlanItem[];
}

export interface MealPlan {
  meals: PlanMeal[];
  notes?: string;
}

/** Split a method paragraph into steps (one per sentence). */
export function methodSteps(method?: string): string[] {
  return (method ?? "")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The recipe a planned meal's logged entries carry: its components + method. */
export function mealRecipe(m: PlanMeal): Recipe | undefined {
  const steps = methodSteps(m.method);
  if (m.items.length < 2 && !steps.length) return undefined;
  return {
    partOf: m.title || undefined,
    ingredients: m.items.map((i) => (i.portion ? `${i.name} (${i.portion})` : i.name)),
    steps,
  };
}

export interface PlanTargets extends Nutrients {
  /** Never plan below this (1200 women / 1500 men) */
  floor: number;
}

/** How far under the calorie goal a plan may land. Over the goal is never allowed. */
export const UNDER_TOLERANCE = 150;

export function calorieWindow(t: PlanTargets) {
  const max = Math.round(t.kcal);
  const min = Math.min(max, Math.max(t.floor, max - UNDER_TOLERANCE));
  return { min, max };
}

const KEYS: (keyof Nutrients)[] = ["kcal", "protein", "carbs", "fat", "fibre"];

export function planTotals(plan: MealPlan): Nutrients {
  const t: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
  for (const m of plan.meals) for (const i of m.items) for (const k of KEYS) t[k] += Number(i[k]) || 0;
  for (const k of KEYS) t[k] = Math.round(t[k]);
  return t;
}

export function checkPlan(plan: MealPlan, targets: PlanTargets) {
  const totals = planTotals(plan);
  const { min, max } = calorieWindow(targets);
  const within = totals.kcal >= min && totals.kcal <= max;
  const problem = within
    ? null
    : totals.kcal > max
      ? `The plan totals ${totals.kcal} kcal, which is ${totals.kcal - max} kcal OVER the ${max} kcal limit.`
      : `The plan totals ${totals.kcal} kcal, which is ${min - totals.kcal} kcal UNDER the ${min} kcal minimum.`;
  return { totals, min, max, within, problem };
}

const MEAL_ORDER: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
const num = (v: unknown, dp = 1) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10 ** dp) / 10 ** dp : 0;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/* eslint-disable @typescript-eslint/no-explicit-any -- untrusted JSON from the model */
/** Validate + normalise a plan from the model (or from storage). Throws if unusable. */
export function normalisePlan(raw: any): MealPlan {
  const meals: PlanMeal[] = (Array.isArray(raw?.meals) ? raw.meals : [])
    .map((m: any) => ({
      meal: (MEAL_ORDER.includes(m?.meal) ? m.meal : "snack") as Meal,
      title: str(m?.title, 100) || "Meal",
      method: str(m?.method, 800) || undefined,
      items: (Array.isArray(m?.items) ? m.items : [])
        .filter((i: any) => str(i?.name, 100))
        .slice(0, 12)
        .map((i: any) => ({
          name: str(i.name, 100),
          portion: str(i.portion, 100) || undefined,
          kitId: Number.isInteger(i.kitId) ? i.kitId : undefined,
          kcal: num(i.kcal, 0),
          protein: num(i.protein),
          carbs: num(i.carbs),
          fat: num(i.fat),
          fibre: num(i.fibre),
        })),
    }))
    .filter((m: PlanMeal) => m.items.length > 0)
    .slice(0, 8)
    .sort((a: PlanMeal, b: PlanMeal) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal));
  if (!meals.length) throw new SyntaxError("Plan had no meals");
  return { meals, notes: str(raw?.notes, 400) || undefined };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Kit items always carry the card's numbers, whatever the model wrote. Unknown kitIds are
 * dropped (treated as normal food). Returns the names of ticked kits missing from the plan.
 */
export function applyKits(plan: MealPlan, kits: PlanKit[]): { plan: MealPlan; missing: string[] } {
  const byId = new Map(kits.map((k) => [k.id, k]));
  const used = new Set<number>();
  const meals = plan.meals.map((m) => ({
    ...m,
    items: m.items.map((i) => {
      const k = i.kitId !== undefined ? byId.get(i.kitId) : undefined;
      if (!k) return { ...i, kitId: undefined };
      used.add(k.id);
      return { ...i, kitId: k.id, name: k.name, brand: k.brand, portion: k.portion || "1 serving", kcal: k.kcal, protein: k.protein, carbs: k.carbs, fat: k.fat, fibre: k.fibre };
    }),
  }));
  return { plan: { ...plan, meals }, missing: kits.filter((k) => !used.has(k.id)).map((k) => k.name) };
}
