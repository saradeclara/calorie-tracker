"use client";

import type { Adjustment } from "@/lib/garmin";
import type { GarminDay } from "@/lib/types";
import { Bar, Icon, Spinner } from "./ui";

export function GarminCard({
  loading,
  data,
  error,
  adj,
  hasProfile,
  onReload,
}: {
  loading: boolean;
  data?: GarminDay;
  error?: string;
  adj: Adjustment | null;
  hasProfile: boolean;
  onReload: () => void;
}) {
  // Not set up on the server: stay out of the way.
  if (data && !data.configured) return null;
  if (!data && !error && !loading) return null;

  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Icon name="activity" className="h-5 w-5 text-protein" /> Garmin
        </h3>
        <button onClick={onReload} className="grid h-8 w-8 place-items-center rounded-full text-muted active:bg-soft" aria-label="Refresh Garmin">
          {loading ? <Spinner className="h-4 w-4" /> : <Icon name="refresh" className="h-4 w-4" />}
        </button>
      </div>

      {error && <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>}

      {data?.configured && (
        <>
          {data.steps != null && (
            <div className="mb-3">
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium">Steps</span>
                <span className="tabular text-muted">
                  <span className="font-semibold text-ink">{data.steps.toLocaleString("en-GB")}</span>
                  {data.stepGoal ? ` / ${data.stepGoal.toLocaleString("en-GB")}` : ""}
                </span>
              </div>
              {data.stepGoal ? <Bar value={data.steps} max={data.stepGoal} color="var(--protein)" /> : null}
            </div>
          )}

          {(data.activities?.length ?? 0) > 0 ? (
            <ul className="mb-3 space-y-1.5">
              {data.activities!.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    {a.name}
                    {a.minutes > 0 && <span className="text-muted"> · {a.minutes} min</span>}
                  </span>
                  <span className="tabular shrink-0 text-muted">{a.kcal} kcal</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-muted">No workouts recorded.</p>
          )}

          <div className="flex items-baseline justify-between border-t border-line pt-3 text-sm">
            <span className="text-muted">Active calories (all movement)</span>
            <span className="tabular font-semibold">{data.activeKcal ?? "—"}</span>
          </div>

          {adj ? (
            <>
              <div className="mt-1 flex items-baseline justify-between text-sm">
                <span className="text-muted">Added to your budget</span>
                <span className="tabular font-semibold text-protein">+{adj.adjustment}</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Resting {adj.resting} + active {adj.active} = {adj.projected} kcal burned, vs your maintenance of {adj.maintenance}.{" "}
                {adj.adjustment > 0
                  ? "You get the difference."
                  : "Nothing extra yet: your activity level already covers this much movement."}
              </p>
            </>
          ) : (
            !hasProfile && (
              <p className="mt-2 text-xs text-muted">
                Fill in the deficit calculator in Goals & settings to turn Garmin activity into extra calories.
              </p>
            )
          )}
        </>
      )}
    </section>
  );
}
