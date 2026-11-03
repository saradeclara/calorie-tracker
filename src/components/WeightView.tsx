"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteWeight } from "@/lib/db";
import { addDays, formatDay, todayKey } from "@/lib/dates";
import { trendChange, withTrend } from "@/lib/weight";
import { Icon, ScreenHeader, Segmented } from "./ui";
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
      <ScreenHeader title="Weight" />

      <div className="space-y-3 px-4">
        {latest && (
          <section className="rounded-[2rem] bg-hero p-5 text-on-hero" aria-label="Weight trend">
            <div className="text-sm text-on-hero-muted">7-day average</div>
            <div className="font-display tabular text-[2.8rem] leading-none font-bold">
              {latest.avg.toFixed(1)}
              <span className="ml-1 text-lg font-medium text-on-hero-muted">kg</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Tile label="This week" value={fmtDelta(week)} unit={week === null ? "" : "kg"} />
              <Tile label="This month" value={fmtDelta(month)} unit={month === null ? "" : "kg"} />
            </div>
          </section>
        )}
        <section className="rounded-[1.375rem] bg-card p-5">
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

            <section className="space-y-3 rounded-[1.375rem] bg-card p-5">
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
              <ul className="divide-y divide-line overflow-hidden rounded-[1.375rem] bg-card">
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
    <div className="rounded-2xl bg-white/10 px-4 py-3">
      <div className="text-xs text-on-hero-muted">{label}</div>
      <div className="font-display tabular text-2xl font-semibold">
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-on-hero-muted">{unit}</span>}
      </div>
    </div>
  );
}
