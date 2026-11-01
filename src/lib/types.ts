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
