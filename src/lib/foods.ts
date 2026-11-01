import type { Food, FoodEntry } from "./types";

/** Lowercase, strip punctuation and collapse spaces: "Flat-White " → "flat white". */
export function norm(s: string | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function nameKeyOf(name: string, brand?: string): string {
  return `${norm(name)}|${norm(brand)}`;
}

type FoodLike = Pick<FoodEntry, "name" | "brand" | "barcode">;

/** Same barcode, or same name + brand. */
export function matches(food: Pick<Food, "barcode" | "nameKey">, item: FoodLike): boolean {
  if (item.barcode && food.barcode && item.barcode === food.barcode) return true;
  return food.nameKey === nameKeyOf(item.name, item.brand);
}

/** Lookup helpers built from the full food list (it's small, so in-memory is fine). */
export function buildFoodIndex(foods: Food[]) {
  const byId = new Map<number, Food>();
  const byBarcode = new Map<string, Food>();
  const byName = new Map<string, Food>();
  for (const f of foods) {
    if (f.id !== undefined) byId.set(f.id, f);
    if (f.barcode) byBarcode.set(f.barcode, f);
    byName.set(f.nameKey, f);
  }
  const find = (item: FoodLike): Food | undefined =>
    (item.barcode ? byBarcode.get(item.barcode) : undefined) ?? byName.get(nameKeyOf(item.name, item.brand));
  return {
    byId,
    find,
    /** The trigger record for this item, if it's a known trigger. */
    trigger(item: FoodLike): Food | undefined {
      const f = find(item);
      return f?.trigger ? f : undefined;
    },
    triggers: foods.filter((f) => f.trigger),
  };
}

export type FoodIndex = ReturnType<typeof buildFoodIndex>;
