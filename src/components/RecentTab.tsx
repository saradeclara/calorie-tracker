"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, relog } from "@/lib/db";
import { FoodEntry, Meal } from "@/lib/types";
import { Icon, inputClass, cx } from "./ui";

export function RecentTab({ date, meal, onAdded }: { date: string; meal: Meal; onAdded: (msg: string) => void }) {
  const [q, setQ] = useState("");
  const recent = useLiveQuery(() => db.entries.orderBy("createdAt").reverse().limit(400).toArray(), []);

  const foods = useMemo(() => {
    const seen = new Map<string, FoodEntry & { count: number }>();
    for (const e of recent ?? []) {
      const key = `${e.name}|${e.brand ?? ""}|${e.portion ?? ""}|${Math.round(e.kcal)}`.toLowerCase();
      const hit = seen.get(key);
      if (hit) hit.count++;
      else seen.set(key, { ...e, count: 1 });
    }
    const list = [...seen.values()];
    const needle = q.trim().toLowerCase();
    return (needle ? list.filter((f) => `${f.name} ${f.brand ?? ""}`.toLowerCase().includes(needle)) : list).slice(0, 50);
  }, [recent, q]);

  const add = async (f: FoodEntry) => {
    await relog(f, date, meal);
    onAdded(`Added ${f.name}`);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Icon name="search" className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className={cx(inputClass, "pl-9")} placeholder="Search foods you've logged" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {recent && foods.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">
          {q ? "No matches." : "Foods you log will show up here for one-tap re-adding."}
        </p>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
        {foods.map((f) => (
          <li key={f.id}>
            <button onClick={() => add(f)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-soft">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{f.name}</div>
                <div className="truncate text-xs text-muted">{[f.brand, f.portion].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <span className="tabular text-sm font-semibold">{Math.round(f.kcal)}</span>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-soft">
                <Icon name="plus" className="h-4 w-4" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
