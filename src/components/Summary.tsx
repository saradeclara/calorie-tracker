import { Goals, Nutrients } from "@/lib/types";
import { round } from "@/lib/nutrition";
import { Bar, MACRO_META, Ring } from "./ui";

/**
 * The day at a glance: the app's one bold block.
 * `bonus` = extra calories earned from Garmin activity (positive adjustment).
 */
export function Summary({ totals, goals, bonus = 0 }: { totals: Nutrients; goals: Goals; bonus?: number }) {
  const budget = goals.kcal + bonus;
  const remaining = Math.round(budget - totals.kcal);
  return (
    <section className="rounded-[2rem] bg-hero p-5 text-on-hero" aria-label="Today's totals">
      <div className="flex items-center gap-5">
        <Ring
          value={totals.kcal}
          max={budget}
          size={148}
          stroke={13}
          color="var(--butter)"
          track="var(--hero-track)"
          overColor="#ff8a6e"
        >
          <div>
            <div className="font-display tabular text-[2.6rem] leading-none font-bold">{Math.abs(remaining)}</div>
            <div className="mt-1 text-xs text-on-hero-muted">{remaining >= 0 ? "kcal left" : "kcal over"}</div>
          </div>
        </Ring>
        <dl className="flex-1 space-y-2 text-sm">
          <Stat label="Eaten" value={`${Math.round(totals.kcal)}`} />
          <Stat label="Goal" value={`${goals.kcal}`} />
          {bonus > 0 && <Stat label="Garmin" value={`+${bonus}`} />}
        </dl>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
        {MACRO_META.map((m) => (
          <div key={m.key}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium">{m.label}</span>
              <span className="tabular text-on-hero-muted">
                <span className="font-semibold text-on-hero">{round(totals[m.key], 0)}</span>/{goals[m.key]}g
              </span>
            </div>
            <Bar value={totals[m.key]} max={goals[m.key]} color={m.onHero} track="var(--hero-track)" />
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-on-hero-muted">{label}</dt>
      <dd className="font-display tabular text-xl font-semibold">{value}</dd>
    </div>
  );
}
