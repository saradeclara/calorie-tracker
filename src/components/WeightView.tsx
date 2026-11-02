"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteWeight } from "@/lib/db";
import { addDays, formatDay, todayKey } from "@/lib/dates";
import { trendChange, withTrend } from "@/lib/weight";
import { Icon, Segmented } from "./ui";
import { WeightChart } from "./WeightChart";
import { WeightInput } from "./WeightInput";

type Range = "30" | "90" | "all";

export function WeightView({ notify }: { notify: (m: string) => void }) {
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const [range, setRange] = useState<Range>("30");
  if (!weights) return null;

  const points = withTrend(weights);
  const shown = range === "all" ? points : points.filter((p) => p.date >= addDays(todayKey(), -Number(range)));
  const latest = points.at(-1);
  const week = trendChange(points, 7);
  const month = trendChange(points, 30);

  return (
    <div className="pb-28">
      <header className="pt-safe sticky top-0 z-20 bg-bg/90 px-4 pb-2 backdrop-blur">
        <h1 className="py-2 text-center text-lg font-semibold">Weight</h1>
      </header>

      <div className="space-y-4 px-4">
        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <p className="mb-2 text-sm font-medium text-muted">Today</p>
          <WeightInput date={todayKey()} notify={notify} compact />
        </section>

        {points.length === 0 ? (
          <p className="px-2 text-center text-sm text-muted">
            Weigh in most mornings, same conditions (after the loo, before eating). The 7-day average smooths out the
            day-to-day water swings, so watch that rather than any single day.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="7-day average" value={`${latest!.avg.toFixed(1)}`} unit="kg" />
              <Tile label="This week" value={fmtDelta(week)} unit={week === null ? "" : "kg"} />
              <Tile label="This month" value={fmtDelta(month)} unit={month === null ? "" : "kg"} />
            </div>

            <section className="space-y-3 rounded-3xl bg-card p-5 shadow-sm">
              <Segmented
                size="sm"
                value={range}
                onChange={setRange}
                options={[
                  { id: "30", label: "30 days" },
                  { id: "90", label: "90 days" },
                  { id: "all", label: "All" },
                ]}
              />
              {shown.length > 0 ? (
                <WeightChart points={shown} />
              ) : (
                <p className="py-8 text-center text-sm text-muted">No weigh-ins in this range.</p>
              )}
            </section>

            {/* The table view: every value, readable without hovering */}
            <section>
              <h2 className="mb-2 px-1 text-sm font-semibold text-muted">Weigh-ins</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-card shadow-sm">
                {[...points].reverse().map((p) => (
                  <li key={p.date} className="flex items-center gap-3 py-2.5 pr-2 pl-5">
                    <span className="flex-1 text-sm">{formatDay(p.date)}</span>
                    <span className="tabular w-16 text-right font-semibold">{p.kg.toFixed(1)}</span>
                    <span className="tabular w-20 text-right text-xs text-muted">avg {p.avg.toFixed(1)}</span>
                    <button
                      onClick={() => deleteWeight(p.date).then(() => notify("Weigh-in deleted"))}
                      className="grid h-9 w-9 place-items-center rounded-full text-muted active:bg-soft"
                      aria-label={`Delete weigh-in for ${formatDay(p.date)}`}
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function fmtDelta(d: number | null) {
  if (d === null) return "—";
  if (d === 0) return "±0.0";
  return `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`;
}

function Tile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-sm">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="tabular text-xl font-semibold">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span>}
      </div>
    </div>
  );
}
