export type Sex = "female" | "male";

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number; // multiplier
  lossKgPerWeek: number; // 0 = maintain
}

export const ACTIVITY = [
  { value: 1.2, label: "Sedentary", hint: "Desk job, little exercise" },
  { value: 1.375, label: "Light", hint: "Exercise 1–3 days a week" },
  { value: 1.55, label: "Moderate", hint: "Exercise 3–5 days a week" },
  { value: 1.725, label: "Very active", hint: "Hard exercise 6–7 days a week" },
] as const;

export const LOSS_RATES = [0, 0.25, 0.5, 0.75] as const;

/** ~7,700 kcal per kg of body fat. */
const KCAL_PER_KG = 7700;

/** Mifflin-St Jeor resting energy, then × activity, minus the weekly-loss deficit. */
export function calculate(p: Profile) {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161);
  const maintenance = bmr * p.activity;
  const deficit = (p.lossKgPerWeek * KCAL_PER_KG) / 7;
  const target = maintenance - deficit;
  // Commonly cited floors for unsupervised dieting.
  const floor = p.sex === "male" ? 1500 : 1200;
  return {
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance),
    deficit: Math.round(deficit),
    target: Math.round(target / 10) * 10,
    belowFloor: target < floor,
    floor,
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
