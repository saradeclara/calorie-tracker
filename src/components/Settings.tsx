"use client";

import { useEffect, useRef, useState } from "react";
import { exportData, getGoals, getSetting, importData, saveGoals, setSetting } from "@/lib/db";
import { Goals } from "@/lib/types";
import { ThemePicker } from "./ThemePicker";
import { Button, Field, Icon, NumberInput, ScreenHeader, Switch, inputClass } from "./ui";
import { DeficitCalculator } from "./DeficitCalculator";
import { macrosFor } from "@/lib/deficit";

type GoalDraft = Record<keyof Goals, number | "">;

const GOAL_FIELDS: { key: keyof Goals; label: string; suffix: string }[] = [
  { key: "kcal", label: "Calories", suffix: "kcal" },
  { key: "protein", label: "Protein", suffix: "g" },
  { key: "carbs", label: "Carbs", suffix: "g" },
  { key: "fat", label: "Fat", suffix: "g" },
  { key: "fibre", label: "Fibre", suffix: "g" },
  { key: "waterMl", label: "Water", suffix: "ml" },
];

export function Settings({ onBack, notify }: { onBack: () => void; notify: (m: string) => void }) {
  const [goals, setGoals] = useState<GoalDraft | null>(null);
  const [passcode, setPasscode] = useState("");
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [weightKg, setWeightKg] = useState<number | undefined>(undefined);
  const [shareReflux, setShareReflux] = useState(false);
  // Settings only renders client-side, so localStorage can be read directly.
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getGoals().then(setGoals);
    getSetting("passcode", "").then(setPasscode);
    getSetting("coachShareReflux", false).then(setShareReflux);
    getSetting<{ weightKg?: number | "" }>("deficitProfile", {}).then((p) =>
      setWeightKg(typeof p.weightKg === "number" ? p.weightKg : undefined),
    );
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, []);

  if (!goals) return null;

  const macroKcal =
    (Number(goals.protein) || 0) * 4 + (Number(goals.carbs) || 0) * 4 + (Number(goals.fat) || 0) * 9;

  return (
    <div className="pb-16">
      <ScreenHeader title="Goals & settings" onBack={onBack} />

      <div className="space-y-4 px-4">
        <section className="space-y-3 rounded-[1.375rem] bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Colour</h2>
          <ThemePicker />
        </section>

        <section className="space-y-3 rounded-[1.375rem] bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Daily goals</h2>
          <div className="grid grid-cols-2 gap-3">
            {GOAL_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <NumberInput
                  value={goals[f.key]}
                  onChange={(v) =>
                    setGoals((g) => {
                      if (!g) return g;
                      // Changing calories recalculates the macros (you can still tweak them after).
                      if (f.key === "kcal" && typeof v === "number" && v > 0) return { ...g, kcal: v, ...macrosFor(v, weightKg) };
                      return { ...g, [f.key]: v };
                    })
                  }
                  suffix={f.suffix}
                  min={0}
                />
              </Field>
            ))}
          </div>
          <p className="text-xs text-muted">
            Your macro goals add up to about <span className="tabular font-medium text-ink">{Math.round(macroKcal)}</span> kcal
            (protein & carbs 4 kcal/g, fat 9 kcal/g). Changing calories recalculates protein, carbs and fat; you can still
            adjust them by hand.
          </p>
          <Button
            className="w-full"
            onClick={async () => {
              const clean = Object.fromEntries(
                Object.entries(goals).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]),
              ) as unknown as Goals;
              await saveGoals(clean);
              notify("Goals saved");
            }}
          >
            Save goals
          </Button>
        </section>

        <DeficitCalculator
          onApply={async (kcal, weight) => {
            setWeightKg(weight);
            const next = { ...goals, kcal, ...macrosFor(kcal, weight) };
            setGoals(next);
            const clean = Object.fromEntries(
              Object.entries(next).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]),
            ) as unknown as Goals;
            await saveGoals(clean);
            notify(`Goals set: ${kcal} kcal`);
          }}
        />

        <section className="space-y-2 rounded-[1.375rem] bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Share reflux triggers with AI</h2>
              <p className="text-xs text-muted">So the coach and meal planner avoid them. Off by default; nothing else about reflux uses AI.</p>
            </div>
            <Switch
              checked={shareReflux}
              label="Share reflux triggers with AI"
              onChange={async (on) => {
                setShareReflux(on);
                await setSetting("coachShareReflux", on);
                notify(on ? "Coach & planner will see your triggers" : "Coach & planner won't see your triggers");
              }}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-[1.375rem] bg-card p-5">
          <h2 className="font-display text-lg font-semibold">AI passcode</h2>
          <p className="text-sm text-muted">
            The same value as <code className="rounded bg-soft px-1">APP_PASSCODE</code> in Vercel. It stops anyone else who finds
            your URL from using your AI credit.
          </p>
          <input
            className={inputClass}
            type="password"
            autoComplete="off"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
          />
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              await setSetting("passcode", passcode.trim());
              notify("Passcode saved");
            }}
          >
            Save passcode
          </Button>
        </section>

        <section className="space-y-3 rounded-[1.375rem] bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Your data</h2>
          <p className="text-sm text-muted">
            Everything is stored on this device only. Export a backup now and then, especially before changing phones.
            {persisted === false && " Your browser may clear storage under pressure — installing to the home screen helps."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                const data = await exportData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `calorie-tracker-${data.exportedAt.slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Icon name="download" className="h-4 w-4" /> Export
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" className="h-4 w-4" /> Import
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (!confirmReplace()) return;
              try {
                await importData(JSON.parse(await f.text()));
                notify("Backup restored");
              } catch (err) {
                notify((err as Error).message || "Import failed");
              }
            }}
          />
        </section>

        <p className="px-2 text-center text-xs text-muted">
          Barcode data from Open Food Facts (openfoodfacts.org), licensed ODbL. AI estimates are approximate.
        </p>
        <p className="tabular px-2 text-center text-xs text-muted">Version {process.env.NEXT_PUBLIC_BUILD}</p>
      </div>
    </div>
  );
}

function confirmReplace() {
  // A native confirm is fine here: it's rare and destructive.
  return window.confirm("Importing replaces all food and water logs on this device. Continue?");
}
