import Dexie, { type EntityTable } from "dexie";
import { DEFAULT_GOALS, FoodEntry, Goals, WaterLog } from "./types";

interface Setting {
  key: string;
  value: unknown;
}

export const db = new Dexie("calorie-tracker") as Dexie & {
  entries: EntityTable<FoodEntry, "id">;
  water: EntityTable<WaterLog, "id">;
  settings: EntityTable<Setting, "key">;
};

db.version(1).stores({
  entries: "++id, date, createdAt, name",
  water: "++id, date",
  settings: "key",
});

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

export interface Backup {
  app: "calorie-tracker";
  version: 1;
  exportedAt: string;
  entries: FoodEntry[];
  water: WaterLog[];
  settings: Setting[];
}

export async function exportData(): Promise<Backup> {
  const [entries, water, settings] = await Promise.all([
    db.entries.toArray(),
    db.water.toArray(),
    db.settings.toArray(),
  ]);
  return {
    app: "calorie-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
    water,
    // Never put the passcode in a backup file.
    settings: settings.filter((s) => s.key !== "passcode"),
  };
}

function withoutId<T extends { id?: number }>(row: T): T {
  const copy = { ...row };
  delete copy.id;
  return copy;
}

export async function importData(backup: Backup) {
  if (backup?.app !== "calorie-tracker" || !Array.isArray(backup.entries)) {
    throw new Error("That doesn't look like a calorie tracker backup.");
  }
  await db.transaction("rw", db.entries, db.water, db.settings, async () => {
    await db.entries.clear();
    await db.water.clear();
    await db.entries.bulkAdd(backup.entries.map(withoutId));
    await db.water.bulkAdd((backup.water ?? []).map(withoutId));
    for (const s of backup.settings ?? []) {
      if (s.key !== "passcode") await db.settings.put(s);
    }
  });
}

/* ---------- Write helpers (keep timestamps out of render code) ---------- */

export type NewEntry = Omit<FoodEntry, "id" | "createdAt">;

export function logEntries(items: NewEntry[]) {
  const now = Date.now();
  return db.entries.bulkAdd(items.map((e, i) => ({ ...e, createdAt: now + i })));
}

export function logEntry(item: NewEntry) {
  return logEntries([item]);
}

/** Copy a past entry into a new day/meal. */
export function relog(entry: FoodEntry, date: string, meal: FoodEntry["meal"]) {
  const { name, brand, portion, source, barcode, kcal, protein, carbs, fat, fibre } = entry;
  return logEntry({ name, brand, portion, source, barcode, kcal, protein, carbs, fat, fibre, date, meal });
}

export function logWater(date: string, ml: number) {
  return db.water.add({ date, ml, createdAt: Date.now() });
}
