import type { GarminBurn } from "./types";

export type Sex = "female" | "male";

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number; // multiplier
  lossKgPerWeek: number; // 0 = maintain
  /** Where maintenance comes from. Default: Garmin when there's enough data. */
  maintenanceSource?: "garmin" | "formula";
}

export const ACTIVITY = [
  { value: 1.2, label: "Sedentary", hint: "Desk job, little exercise" },
  { value: 1.375, label: "Light", hint: "Exercise 1–3 days a week" },
  { value: 1.55, label: "Moderate", hint: "Exercise 3–5 days a week" },
  { value: 1.725, label: "Very active", hint: "Hard exercise 6–7 days a week" },
] as const;

export const LOSS_RATES = [0, 0.25, 0.5, 0.75, 1] as const;

/** ~7,700 kcal per kg of body fat. */
export const KCAL_PER_KG = 7700;

/** Garmin needs at least a week of worn days before its average is trusted. */
export const MIN_GARMIN_DAYS = 7;

export const garminUsable = (burn: GarminBurn | null | undefined): burn is GarminBurn & { avgTotal: number; avgActive: number; days: number } =>
  !!burn?.configured && (burn.days ?? 0) >= MIN_GARMIN_DAYS && !!burn.avgTotal && burn.avgActive != null;

/**
 * Maintenance = your Garmin average daily burn (when available and chosen), otherwise
 * Mifflin-St Jeor resting × activity level. Target = maintenance − deficit for the chosen
 * weekly loss, but never below a safe floor (1200 women / 1500 men); when the floor kicks in
 * we report the rate you'll actually get.
 */
export function calculate(p: Profile, burn?: GarminBurn | null) {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161);
  const useGarmin = p.maintenanceSource !== "formula" && garminUsable(burn);
  const maintenance = useGarmin ? burn!.avgTotal! : bmr * p.activity;
  const deficit = (p.lossKgPerWeek * KCAL_PER_KG) / 7;
  // Commonly cited floors for unsupervised dieting.
  const floor = p.sex === "male" ? 1500 : 1200;
  const raw = maintenance - deficit;
  const target = Math.round(Math.min(maintenance, Math.max(raw, floor)) / 10) * 10;
  const actualRate = Math.max(0, Math.round((((maintenance - target) * 7) / KCAL_PER_KG) * 20) / 20); // nearest 0.05
  return {
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance),
    source: useGarmin ? ("garmin" as const) : ("formula" as const),
    deficit: Math.round(deficit),
    target,
    floor,
    /** The chosen rate needs a target below the floor; target was raised to it. */
    clamped: raw < floor && p.lossKgPerWeek > 0,
    actualRate,
  };
}

/**
 * Macro split for a calorie target:
 * - protein 1.6 g/kg body weight (protects muscle in a deficit), capped at 40% of calories;
 *   25% of calories if weight is unknown
 * - fat 30% of calories
 * - carbs = the rest
 */
export function macrosFor(kcal: number, weightKg?: number) {
  const cap = (kcal * 0.4) / 4;
  const protein = weightKg && weightKg > 0 ? Math.min(weightKg * 1.6, cap) : (kcal * 0.25) / 4;
  const fat = (kcal * 0.3) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
}
