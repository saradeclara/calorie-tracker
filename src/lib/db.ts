import Dexie, { type EntityTable } from "dexie";
import { DEFAULT_GOALS, Food, FoodEntry, Goals, Reaction, Severity, WaterLog, WeightEntry } from "./types";
import { nameKeyOf } from "./foods";

interface Setting {
  key: string;
  value: unknown;
}

export const db = new Dexie("calorie-tracker") as Dexie & {
  entries: EntityTable<FoodEntry, "id">;
  water: EntityTable<WaterLog, "id">;
  settings: EntityTable<Setting, "key">;
  foods: EntityTable<Food, "id">;
  reactions: EntityTable<Reaction, "id">;
  weights: EntityTable<WeightEntry, "date">;
};

db.version(1).stores({
  entries: "++id, date, createdAt, name",
  water: "++id, date",
  settings: "key",
});

// v2: food database + reflux reactions. Existing entries are backfilled into
// the food database the first time the updated app opens.
db.version(2)
  .stores({
    entries: "++id, date, createdAt, name, foodId",
    water: "++id, date",
    settings: "key",
    foods: "++id, barcode, nameKey, lastUsed",
    reactions: "++id, foodId, entryId, date, at",
  })
  .upgrade(async (tx) => {
    await backfillFoods(tx.table("entries"), tx.table("foods"));
  });

// v3: weight log
db.version(3).stores({
  entries: "++id, date, createdAt, name, foodId",
  water: "++id, date",
  settings: "key",
  foods: "++id, barcode, nameKey, lastUsed",
  reactions: "++id, foodId, entryId, date, at",
  weights: "date",
});

/* ---------- Food database ---------- */

type FoodsTable = EntityTable<Food, "id">;
type EntriesTable = EntityTable<FoodEntry, "id">;

type FoodFields = Pick<
  FoodEntry,
  "name" | "brand" | "barcode" | "portion" | "source" | "kcal" | "protein" | "carbs" | "fat" | "fibre"
>;

async function findFoodIn(foods: FoodsTable, item: Pick<FoodEntry, "name" | "brand" | "barcode">) {
  if (item.barcode) {
    const hit = await foods.where("barcode").equals(item.barcode).first();
    if (hit) return hit;
  }
  return foods.where("nameKey").equals(nameKeyOf(item.name, item.brand)).first();
}

/**
 * Create or refresh the food record for an entry ("latest wins") and return its id.
 * `used` = this is a new log of the food (bumps the use count).
 */
async function upsertFood(foods: FoodsTable, item: FoodFields, at: number, used: boolean): Promise<number> {
  const latest = {
    name: item.name,
    brand: item.brand,
    nameKey: nameKeyOf(item.name, item.brand),
    portion: item.portion,
    source: item.source,
    kcal: item.kcal,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    fibre: item.fibre,
  };
  const existing = await findFoodIn(foods, item);
  if (existing?.id !== undefined) {
    await foods.update(existing.id, {
      ...latest,
      // A saved meal keeps its pack/card numbers when logged at its saved portion.
      ...(existing.kind === "recipe" && item.portion === existing.portion
        ? { kcal: existing.kcal, protein: existing.protein, carbs: existing.carbs, fat: existing.fat, fibre: existing.fibre }
        : {}),
      barcode: existing.barcode ?? item.barcode,
      useCount: existing.useCount + (used ? 1 : 0),
      lastUsed: Math.max(existing.lastUsed, at),
    });
    return existing.id;
  }
  return (await foods.add({
    ...latest,
    barcode: item.barcode,
    useCount: 1,
    lastUsed: at,
    trigger: false,
  })) as number;
}

async function backfillFoods(entries: EntriesTable, foods: FoodsTable) {
  const all = await entries.toArray();
  all.sort((a, b) => a.createdAt - b.createdAt);
  for (const e of all) {
    const foodId = await upsertFood(foods, e, e.createdAt, true);
    if (e.id !== undefined) await entries.update(e.id, { foodId });
  }
}

/* ---------- Settings ---------- */

export async function getGoals(): Promise<Goals> {
  const row = await db.settings.get("goals");
  return { ...DEFAULT_GOALS, ...((row?.value as Partial<Goals>) ?? {}) };
}

export async function saveGoals(goals: Goals) {
  await db.settings.put({ key: "goals", value: goals });
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

/* ---------- Entries (all writes keep the food database in sync) ---------- */

export type NewEntry = Omit<FoodEntry, "id" | "createdAt" | "foodId">;

export function logEntries(items: NewEntry[]) {
  const now = Date.now();
  return db.transaction("rw", db.entries, db.foods, async () => {
    for (const [i, item] of items.entries()) {
      const createdAt = now + i;
      const foodId = await upsertFood(db.foods, item, createdAt, true);
      await db.entries.add({ ...item, foodId, createdAt });
    }
  });
}

export function logEntry(item: NewEntry) {
  return logEntries([item]);
}

/** Copy a past entry into a new day/meal. */
export function relog(entry: FoodEntry, date: string, meal: FoodEntry["meal"]) {
  const { name, brand, portion, source, barcode, kcal, protein, carbs, fat, fibre } = entry;
  return logEntry({ name, brand, portion, source, barcode, kcal, protein, carbs, fat, fibre, date, meal });
}

/** Log a food from the database with its latest portion. */
export function relogFood(food: Food, date: string, meal: FoodEntry["meal"]) {
  const { name, brand, portion, source, barcode, kcal, protein, carbs, fat, fibre } = food;
  return logEntry({ name, brand, portion, source, barcode, kcal, protein, carbs, fat, fibre, date, meal });
}

/** Edit an entry. The food record takes the new values; a rename re-links to that food. */
export function updateEntry(entry: FoodEntry, changes: Partial<NewEntry>) {
  return db.transaction("rw", db.entries, db.foods, async () => {
    const next = { ...entry, ...changes };
    const foodId = await upsertFood(db.foods, next, entry.createdAt, false);
    await db.entries.update(entry.id!, { ...changes, foodId });
  });
}

export function deleteEntry(id: number) {
  return db.entries.delete(id);
}

/** Make sure an entry is linked to a food record (older entries may not be). */
export async function ensureFoodId(entry: FoodEntry): Promise<number> {
  if (entry.foodId !== undefined && (await db.foods.get(entry.foodId))) return entry.foodId;
  return db.transaction("rw", db.entries, db.foods, async () => {
    const foodId = await upsertFood(db.foods, entry, entry.createdAt, false);
    await db.entries.update(entry.id!, { foodId });
    return foodId;
  });
}

/* ---------- Meal-kit recipes ---------- */

/**
 * Save (or update) a "saved meal" (meal kit, ready meal, packaged food) with a fixed portion and
 * the exact numbers from its pack/card. Returns its id.
 */
export function saveRecipe(r: {
  name: string;
  provider?: string;
  portion?: string;
  barcode?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}) {
  return db.transaction("rw", db.foods, async () => {
    const brand = r.provider?.trim() || undefined;
    const fields = {
      name: r.name.trim(),
      brand,
      nameKey: nameKeyOf(r.name, brand),
      portion: r.portion?.trim() || "1 serving",
      barcode: r.barcode,
      source: "manual" as const,
      kcal: r.kcal,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      fibre: r.fibre,
      kind: "recipe" as const,
    };
    const existing = await db.foods.where("nameKey").equals(fields.nameKey).first();
    if (existing?.id !== undefined) {
      await db.foods.update(existing.id, { ...fields, lastUsed: Date.now() });
      return existing.id;
    }
    return (await db.foods.add({ ...fields, useCount: 0, lastUsed: Date.now(), trigger: false })) as number;
  });
}

/* ---------- Reflux ---------- */

export function setTrigger(foodId: number, value: { trigger: boolean; severity?: Severity }) {
  return db.foods.update(foodId, {
    trigger: value.trigger,
    triggerSeverity: value.trigger ? (value.severity ?? 1) : undefined,
  });
}

/* ---------- Weight ---------- */

/**
 * Save a weigh-in (replaces any for that day). If it's your most recent one, the deficit
 * calculator's weight is updated too, so maintenance/Garmin/protein targets stay current.
 */
export async function logWeight(date: string, kg: number) {
  await db.transaction("rw", db.weights, db.settings, async () => {
    await db.weights.put({ date, kg, createdAt: Date.now() });
    const latest = await db.weights.orderBy("date").last();
    if (latest?.date === date) {
      const row = await db.settings.get("deficitProfile");
      const profile = (row?.value as Record<string, unknown>) ?? {};
      await db.settings.put({ key: "deficitProfile", value: { ...profile, weightKg: kg } });
    }
  });
}

export function deleteWeight(date: string) {
  return db.weights.delete(date);
}

/* ---------- Water ---------- */

export function logWater(date: string, ml: number) {
  return db.water.add({ date, ml, createdAt: Date.now() });
}

/* ---------- Backup ---------- */

export interface Backup {
  app: "calorie-tracker";
  version: 1 | 2;
  exportedAt: string;
  entries: FoodEntry[];
  water: WaterLog[];
  settings: Setting[];
  foods?: Food[];
  reactions?: Reaction[];
  weights?: WeightEntry[];
}

export async function exportData(): Promise<Backup> {
  const [entries, water, settings, foods, reactions, weights] = await Promise.all([
    db.entries.toArray(),
    db.water.toArray(),
    db.settings.toArray(),
    db.foods.toArray(),
    db.reactions.toArray(),
    db.weights.toArray(),
  ]);
  return {
    app: "calorie-tracker",
    version: 2,
    exportedAt: new Date().toISOString(),
    entries,
    water,
    foods,
    reactions,
    weights,
    // Never put the passcode in a backup file.
    settings: settings.filter((s) => s.key !== "passcode"),
  };
}

export async function importData(backup: Backup) {
  if (backup?.app !== "calorie-tracker" || !Array.isArray(backup.entries)) {
    throw new Error("That doesn't look like a calorie tracker backup.");
  }
  await db.transaction("rw", [db.entries, db.water, db.settings, db.foods, db.reactions, db.weights], async () => {
    await Promise.all([db.entries.clear(), db.water.clear(), db.foods.clear(), db.reactions.clear(), db.weights.clear()]);
    await db.weights.bulkPut(backup.weights ?? []);
    // Ids are kept so entries, foods and reactions stay linked.
    await db.entries.bulkPut(backup.entries);
    await db.water.bulkPut(backup.water ?? []);
    if (backup.foods?.length) {
      await db.foods.bulkPut(backup.foods);
      await db.reactions.bulkPut(backup.reactions ?? []);
    } else {
      // Older backup without a food database: rebuild it from the entries.
      await backfillFoods(db.entries, db.foods);
    }
    for (const s of backup.settings ?? []) {
      if (s.key !== "passcode") await db.settings.put(s);
    }
  });
}
