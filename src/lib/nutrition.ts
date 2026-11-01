import { Nutrients, Product, ZERO } from "./types";

const KEYS: (keyof Nutrients)[] = ["kcal", "protein", "carbs", "fat", "fibre"];

export function sum(items: Nutrients[]): Nutrients {
  const total = { ...ZERO };
  for (const item of items) {
    for (const k of KEYS) total[k] += Number(item[k]) || 0;
  }
  return total;
}

export function scale(n: Nutrients, factor: number): Nutrients {
  const out = { ...ZERO };
  for (const k of KEYS) out[k] = round(n[k] * factor, k === "kcal" ? 0 : 1);
  return out;
}

export function round(value: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round((Number(value) || 0) * f) / f;
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Turn an Open Food Facts v2 product into our Product shape.
 * Returns null when there's no usable energy value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOffProduct(barcode: string, p: any): Product | null {
  if (!p) return null;
  const n = p.nutriments ?? {};
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal === undefined) {
    const kj = num(n["energy-kj_100g"]) ?? num(n["energy_100g"]);
    if (kj !== undefined) kcal = kj / 4.184;
  }
  if (kcal === undefined) return null;

  const name =
    p.product_name_en || p.product_name || p.generic_name_en || p.generic_name || "Unknown product";
  const brand = typeof p.brands === "string" ? p.brands.split(",")[0].trim() : undefined;
  // Drinks are usually labelled per 100 ml; OFF exposes that via nutrition_data_per
  // or a pack quantity like "330 ml" / "1 L".
  const unit: "g" | "ml" =
    String(p.nutrition_data_per ?? "").includes("ml") ||
    /\d\s*(ml|cl|l)\b/i.test(String(p.quantity ?? ""))
      ? "ml"
      : "g";

  return {
    barcode,
    name: String(name).trim(),
    brand: brand || undefined,
    imageUrl: p.image_front_small_url || p.image_small_url || undefined,
    unit,
    per100: {
      kcal: round(kcal, 0),
      protein: round(num(n.proteins_100g) ?? 0, 1),
      carbs: round(num(n.carbohydrates_100g) ?? 0, 1),
      fat: round(num(n.fat_100g) ?? 0, 1),
      fibre: round(num(n.fiber_100g) ?? 0, 1),
    },
    servingSize: p.serving_size || undefined,
    servingQuantity: num(p.serving_quantity),
  };
}
