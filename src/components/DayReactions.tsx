"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatTime } from "@/lib/dates";
import type { FoodIndex } from "@/lib/foods";
import { Icon } from "./ui";
import { SeverityChip } from "./Reflux";

/** The day's logged reflux reactions (logging happens from a food's edit sheet). */
export function DayReactions({
  date,
  foods,
  onOpen,
}: {
  date: string;
  foods: FoodIndex;
  onOpen: (entryId: number) => void;
}) {
  const reactions = useLiveQuery(() => db.reactions.where("date").equals(date).sortBy("at"), [date]);
  if (!reactions?.length) return null;

  return (
    <section className="rounded-3xl bg-card shadow-sm">
      <h3 className="flex items-center gap-2 px-5 pt-4 pb-2 font-semibold">
        <Icon name="flame" className="h-4 w-4 text-[var(--severe)]" /> Reflux
      </h3>
      <ul className="pb-2">
        {reactions.map((r) => {
          const food = foods.byId.get(r.foodId);
          return (
            <li key={r.id}>
              <button
                disabled={r.entryId === undefined}
                onClick={() => r.entryId !== undefined && onOpen(r.entryId)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:bg-soft disabled:active:bg-transparent"
              >
                <span className="tabular w-11 shrink-0 text-sm text-muted">{formatTime(r.at)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{food?.name ?? "Unknown food"}</div>
                  {(r.symptoms.length > 0 || r.note) && (
                    <div className="truncate text-xs text-muted">{[r.symptoms.join(", "), r.note].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
                <SeverityChip severity={r.severity} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
