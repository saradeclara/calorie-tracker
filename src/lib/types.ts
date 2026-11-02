export type Meal = "breakfast" | "lunch" | "dinner" | "snack";

export const MEALS: { id: Meal; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snacks" },
];

/** Absolute nutrient amounts (kcal + grams). */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export type EntrySource = "barcode" | "ai" | "manual";

export interface FoodEntry extends Nutrients {
  id?: number;
  /** Link to the food database record (set automatically on save). */
  foodId?: number;
  /** Local calendar day, YYYY-MM-DD */
  date: string;
  meal: Meal;
  name: string;
  brand?: string;
  /** Human readable portion, e.g. "150 g" or "1 serving (30 g)" */
  portion?: string;
  source: EntrySource;
  barcode?: string;
  createdAt: number;
}

export interface WaterLog {
  id?: number;
  date: string;
  ml: number;
  createdAt: number;
}

export interface Goals extends Nutrients {
  waterMl: number;
}

export const DEFAULT_GOALS: Goals = {
  kcal: 2000,
  protein: 120,
  carbs: 220,
  fat: 70,
  fibre: 30,
  waterMl: 2000,
};

/** Product returned by the barcode lookup route. Values per 100 g/ml. */
export interface Product {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  per100: Nutrients;
  /** Unit for the per-100 values */
  unit: "g" | "ml";
  servingSize?: string;
  servingQuantity?: number;
}

export interface AiItem extends Nutrients {
  name: string;
  portion: string;
  confidence: "low" | "medium" | "high";
}

export interface AiEstimate {
  items: AiItem[];
  notes: string;
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

/* ---------- Food database & reflux ---------- */

export type Severity = 1 | 2 | 3;

export const SEVERITIES: { id: Severity; label: string }[] = [
  { id: 1, label: "Mild" },
  { id: 2, label: "Moderate" },
  { id: 3, label: "Severe" },
];

export const severityLabel = (s: Severity) => SEVERITIES.find((x) => x.id === s)?.label ?? "";

/** One record per distinct food, kept up to date automatically as you log. */
export interface Food extends Nutrients {
  id?: number;
  /** Normalised name + brand, used to recognise the same food again. */
  nameKey: string;
  barcode?: string;
  name: string;
  brand?: string;
  /** Latest portion used */
  portion?: string;
  source: EntrySource;
  useCount: number;
  lastUsed: number;
  trigger: boolean;
  triggerSeverity?: Severity;
}

/** Reflux reactions (no longer used by the UI; the table is kept so older data stays valid). */
export interface Reaction {
  id?: number;
  foodId: number;
  /** The logged entry it was recorded from (cleared if that entry is deleted). */
  entryId?: number;
  /** Local day of the reaction, YYYY-MM-DD */
  date: string;
  /** When the reaction happened (ms epoch) */
  at: number;
  severity: Severity;
  symptoms: string[];
  note?: string;
  createdAt: number;
}

/** An AI meal/snack suggestion. Nutrients are for the whole suggested portion. */
export interface MealIdea extends Nutrients {
  name: string;
  description: string;
  ingredients: string[];
  method: string;
  portion: string;
}

/* ---------- Garmin ---------- */

export interface GarminActivity {
  id: string;
  name: string;
  type: string;
  minutes: number;
  kcal: number;
  start: string;
}

export interface GarminDay {
  configured: boolean;
  /** Garmin's active calories for the day so far (all movement, incl. workouts) */
  activeKcal?: number | null;
  totalKcal?: number | null;
  steps?: number | null;
  stepGoal?: number | null;
  activities?: GarminActivity[];
}
