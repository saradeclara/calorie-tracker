"use client";

import { db, logWater } from "@/lib/db";
import { WaterLog } from "@/lib/types";
import { Bar, Icon } from "./ui";

export function WaterCard({
  date,
  totalMl,
  goalMl,
  logs,
}: {
  date: string;
  totalMl: number;
  goalMl: number;
  logs: WaterLog[];
}) {
  const add = (ml: number) => logWater(date, ml);
  const undo = async () => {
    const last = [...logs].sort((a, b) => b.createdAt - a.createdAt)[0];
    if (last?.id) await db.water.delete(last.id);
  };

  return (
    <section className="rounded-[1.375rem] bg-card p-5">
      <div className="mb-3 flex items-baseline gap-3">
        <h3 className="font-display flex items-center gap-2 self-center text-lg font-semibold">
          <Icon name="drop" weight="fill" className="h-5 w-5 text-water" /> Water
        </h3>
        <div className="tabular text-sm text-muted">
          <span className="font-display text-xl font-semibold text-ink">{(totalMl / 1000).toFixed(2)}</span> / {(goalMl / 1000).toFixed(1)} L
        </div>
      </div>
      <Bar value={totalMl} max={goalMl} color="var(--water)" />
      <div className="mt-4 flex gap-2">
        {[250, 500].map((ml) => (
          <button
            key={ml}
            onClick={() => add(ml)}
            className="h-10 flex-1 rounded-full bg-water/12 text-sm font-semibold text-water active:scale-95"
          >
            + {ml} ml
          </button>
        ))}
        <button
          onClick={undo}
          disabled={logs.length === 0}
          className="h-10 rounded-full bg-soft px-4 text-sm font-medium text-muted active:scale-95 disabled:opacity-40"
        >
          Undo
        </button>
      </div>
    </section>
  );
}
