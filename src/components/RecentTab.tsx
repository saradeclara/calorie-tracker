"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, relogFood } from "@/lib/db";
import { norm } from "@/lib/foods";
import { Meal } from "@/lib/types";
import { Icon, inputClass, cx } from "./ui";
import { TriggerWarning } from "./Reflux";

/** Your food database, most recently used first. One tap logs it again. */
export function RecentTab({ date, meal, onAdded }: { date: string; meal: Meal; onAdded: (msg: string) => void }) {
  const [q, setQ] = useState("");
  const foods = useLiveQuery(() => db.foods.orderBy("lastUsed").reverse().toArray(), []);

  const list = useMemo(() => {
    const needle = norm(q);
    const all = foods ?? [];
    return (needle ? all.filter((f) => norm(`${f.name} ${f.brand ?? ""}`).includes(needle)) : all).slice(0, 60);
  }, [foods, q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Icon name="search" className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className={cx(inputClass, "pl-9")} placeholder="Search your foods" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {foods && list.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">
          {q ? "No matches." : "Foods you log are saved here automatically for one-tap re-adding."}
        </p>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
        {list.map((f) => (
          <li key={f.id}>
            <button
              onClick={async () => {
                await relogFood(f, date, meal);
                onAdded(`Added ${f.name}`);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-soft"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{f.name}</span>
                  {f.kind === "recipe" && (
                    <span className="shrink-0 rounded-full bg-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Saved</span>
                  )}
                </div>
                <div className="truncate text-xs text-muted">{[f.brand, f.portion].filter(Boolean).join(" · ") || "—"}</div>
                {f.trigger && <TriggerWarning food={f} compact />}
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
