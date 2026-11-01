import { Goals, Nutrients } from "@/lib/types";
import { round } from "@/lib/nutrition";
import { Bar, MACRO_META, Ring } from "./ui";

export function Summary({ totals, goals }: { totals: Nutrients; goals: Goals }) {
  const remaining = Math.round(goals.kcal - totals.kcal);
  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      <div className="flex items-center gap-5">
        <Ring value={totals.kcal} max={goals.kcal}>
          <div>
            <div className="tabular text-3xl font-bold leading-none">{Math.abs(remaining)}</div>
            <div className="mt-1 text-xs text-muted">{remaining >= 0 ? "kcal left" : "kcal over"}</div>
          </div>
        </Ring>
        <div className="flex-1 space-y-1 text-sm">
          <Stat label="Eaten" value={`${Math.round(totals.kcal)}`} />
          <Stat label="Goal" value={`${goals.kcal}`} />
          <div className="pt-1 text-xs text-muted">kcal</div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
        {MACRO_META.map((m) => (
          <div key={m.key}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{m.label}</span>
              <span className="tabular text-muted">
                <span className="text-ink">{round(totals[m.key], 0)}</span>/{goals[m.key]}g
              </span>
            </div>
            <Bar value={totals[m.key]} max={goals[m.key]} color={m.color} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line pb-1">
      <span className="text-muted">{label}</span>
      <span className="tabular text-lg font-semibold">{value}</span>
    </div>
  );
}
