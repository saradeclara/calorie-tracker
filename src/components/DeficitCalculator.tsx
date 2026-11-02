"use client";

import { useEffect, useState } from "react";
import { getSetting, setSetting } from "@/lib/db";
import { ACTIVITY, LOSS_RATES, MIN_GARMIN_DAYS, Profile, calculate, garminUsable, macrosFor } from "@/lib/deficit";
import { useGarminBurn } from "@/lib/garmin";
import { fromKey } from "@/lib/dates";
import { Button, Field, Icon, NumberInput, Segmented, Spinner, cx } from "./ui";

const shortDate = (k?: string) => (k ? fromKey(k).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

type Draft = Omit<Profile, "age" | "heightCm" | "weightKg"> & {
  age: number | "";
  heightCm: number | "";
  weightKg: number | "";
};

const DEFAULT: Draft = { sex: "female", age: "", heightCm: "", weightKg: "", activity: 1.375, lossKgPerWeek: 0.5 };

export function DeficitCalculator({ onApply }: { onApply: (kcal: number, weightKg: number) => void }) {
  const [d, setD] = useState<Draft | null>(null);
  const garmin = useGarminBurn();
  const burn = garmin.burn;

  useEffect(() => {
    getSetting<Draft>("deficitProfile", DEFAULT).then((saved) => setD({ ...DEFAULT, ...saved }));
  }, []);

  if (!d) return null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    const next = { ...d, [k]: v };
    setD(next);
    setSetting("deficitProfile", next); // remembered on this device
  };

  const complete = d.age !== "" && d.heightCm !== "" && d.weightKg !== "" && d.age > 0 && d.heightCm > 0 && d.weightKg > 0;
  const r = complete ? calculate(d as Profile, burn) : null;
  const hasGarmin = !!burn?.configured;
  const usable = garminUsable(burn);
  const wantsGarmin = d.maintenanceSource !== "formula";
  const showActivity = !hasGarmin || !wantsGarmin || !usable;
  const m = r ? macrosFor(r.target, Number(d.weightKg)) : null;

  return (
    <section className="space-y-3 rounded-3xl bg-card p-5 shadow-sm">
      <h2 className="font-semibold">Calorie deficit calculator</h2>

      <Segmented
        size="sm"
        value={d.sex}
        onChange={(v) => set("sex", v)}
        options={[
          { id: "female", label: "Female" },
          { id: "male", label: "Male" },
        ]}
      />
      <div className="grid grid-cols-3 gap-2">
        <Field label="Age">
          <NumberInput value={d.age} onChange={(v) => set("age", v)} min={15} />
        </Field>
        <Field label="Height">
          <NumberInput value={d.heightCm} onChange={(v) => set("heightCm", v)} suffix="cm" min={0} />
        </Field>
        <Field label="Weight">
          <NumberInput value={d.weightKg} onChange={(v) => set("weightKg", v)} suffix="kg" min={0} step="0.1" />
        </Field>
      </div>

      {hasGarmin && (
        <div className="space-y-2">
          <span className="block text-sm font-medium text-muted">Maintenance based on</span>
          <Segmented
            size="sm"
            value={wantsGarmin ? "garmin" : "formula"}
            onChange={(v) => set("maintenanceSource", v)}
            options={[
              { id: "garmin", label: "My Garmin burn" },
              { id: "formula", label: "Activity level" },
            ]}
          />
          {wantsGarmin && (
            <div className="flex items-start justify-between gap-2 rounded-xl bg-soft px-3 py-2 text-xs text-muted">
              <span>
                {garmin.error ? (
                  <span className="text-accent">{garmin.error}</span>
                ) : usable ? (
                  <>
                    Average <b className="tabular text-ink">{burn!.avgTotal!.toLocaleString("en-GB")} kcal/day</b> over{" "}
                    {burn!.days} days you wore your watch ({shortDate(burn!.from)} – {shortDate(burn!.to)}).
                  </>
                ) : burn?.days !== undefined ? (
                  <>
                    Only {burn.days} worn days in the last 4 weeks. Garmin needs {MIN_GARMIN_DAYS}, so your activity level is
                    used for now.
                  </>
                ) : (
                  "Fetching your Garmin average…"
                )}
              </span>
              <button
                type="button"
                onClick={garmin.refresh}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full active:bg-card"
                aria-label="Refresh Garmin average"
              >
                {garmin.loading ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="refresh" className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>
      )}

      {showActivity && (
      <div>
        <span className="mb-1 block text-sm font-medium text-muted">Activity level</span>
        <div className="grid grid-cols-2 gap-2">
          {ACTIVITY.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => set("activity", a.value)}
              className={cx(
                "rounded-xl px-3 py-2 text-left",
                d.activity === a.value ? "bg-ink text-bg" : "bg-soft text-ink",
              )}
            >
              <div className="text-sm font-semibold">{a.label}</div>
              <div className={cx("text-xs", d.activity === a.value ? "opacity-75" : "text-muted")}>{a.hint}</div>
            </button>
          ))}
        </div>
      </div>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium text-muted">Goal · kg lost per week</span>
        <Segmented
          size="sm"
          value={String(d.lossKgPerWeek)}
          onChange={(v) => set("lossKgPerWeek", Number(v))}
          options={LOSS_RATES.map((x) => ({ id: String(x), label: x === 0 ? "Maintain" : `−${x}` }))}
        />
      </div>

      {r ? (
        <div className="space-y-3 rounded-2xl bg-soft p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label={r.source === "garmin" ? "Garmin burn" : "Maintenance"} value={r.maintenance} />
            <Stat label="Deficit" value={r.maintenance - r.target} />
            <Stat label="Target" value={r.target} strong />
          </div>
          {m && (
            <p className="tabular text-center text-sm">
              Protein <b>{m.protein} g</b> · Carbs <b>{m.carbs} g</b> · Fat <b>{m.fat} g</b>
            </p>
          )}
          {r.clamped && (
            <p className="rounded-xl bg-card p-3 text-sm">
              {d.lossKgPerWeek} kg a week would need {Math.max(0, r.maintenance - r.deficit)} kcal/day, below the {r.floor} kcal
              safe minimum. Your target is set to <b>{r.target}</b>, which is about{" "}
              <b>{r.actualRate.toFixed(2).replace(/0$/, "")} kg a week</b>.
            </p>
          )}
          <p className="text-xs text-muted">
            {r.source === "garmin"
              ? "Maintenance is what Garmin measured you burning on an average day"
              : "Maintenance = resting burn (Mifflin-St Jeor) × activity level"}
            {r.target < r.maintenance && <>, minus a deficit (≈7,700 kcal per kg lost)</>}. Never below {r.floor} kcal. It&apos;s an
            estimate: adjust after a few weeks based on how your weight actually moves. Macros: protein 1.6 g per kg of body
            weight, fat 30% of calories, carbs the rest.
          </p>
          <Button type="button" className="w-full" onClick={() => onApply(r.target, Number(d.weightKg))}>
            Use {r.target} kcal + these macros as my goals
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Fill in age, height and weight to see your numbers.</p>
      )}
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <div className={cx("tabular text-xl font-bold", strong && "text-accent")}>{value}</div>
      <div className="text-[11px] text-muted">{label} kcal</div>
    </div>
  );
}
