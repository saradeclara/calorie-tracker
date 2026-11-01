"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteReaction, ensureFoodId, logReaction, setTrigger } from "@/lib/db";
import { defaultReactionTime, formatDateTime } from "@/lib/dates";
import { FoodEntry, SYMPTOMS, Severity } from "@/lib/types";
import { Button, Icon, cx, inputClass } from "./ui";
import { SEVERITY_COLOR, SeverityChip, SeverityPicker } from "./Reflux";

/** Reflux controls for one logged item: trigger flag + logging reactions. */
export function RefluxSection({ entry, notify }: { entry: FoodEntry; notify: (m: string) => void }) {
  const [foodId, setFoodId] = useState<number | undefined>(entry.foodId);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    let live = true;
    ensureFoodId(entry).then((id) => live && setFoodId(id)).catch(console.error);
    return () => {
      live = false;
    };
  }, [entry]);

  const food = useLiveQuery(() => (foodId !== undefined ? db.foods.get(foodId) : undefined), [foodId]);
  const reactions = useLiveQuery(
    () => db.reactions.where("entryId").equals(entry.id!).sortBy("at"),
    [entry.id],
  );

  const run = (p: Promise<unknown>) => p.catch((e) => notify(`Couldn't save: ${(e as Error)?.message ?? e}`));

  if (!food || foodId === undefined) return null;

  return (
    <section className="space-y-3 rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold">
            <Icon name="flame" className="h-4 w-4" style={{ color: food.trigger ? SEVERITY_COLOR[food.triggerSeverity ?? 1] : undefined }} />
            Reflux trigger
          </h3>
          <p className="text-xs text-muted">Applies every time you log {food.name}</p>
        </div>
        <Switch
          checked={food.trigger}
          label="Reflux trigger"
          onChange={(on) =>
            run(setTrigger(foodId, { trigger: on, severity: food.triggerSeverity ?? 1, note: food.triggerNote }))
          }
        />
      </div>

      {food.trigger && (
        <div className="space-y-2">
          <SeverityPicker
            value={food.triggerSeverity ?? 1}
            onChange={(s) => run(setTrigger(foodId, { trigger: true, severity: s, note: food.triggerNote }))}
          />
          <TriggerNote
            key={foodId}
            initial={food.triggerNote ?? ""}
            onSave={(note) => run(setTrigger(foodId, { trigger: true, severity: food.triggerSeverity, note }))}
          />
        </div>
      )}

      {(reactions?.length ?? 0) > 0 && (
        <ul className="space-y-2 border-t border-line pt-3">
          {reactions!.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Reaction · {formatDateTime(r.at)}</span>
                  <SeverityChip severity={r.severity} />
                </div>
                {(r.symptoms.length > 0 || r.note) && (
                  <p className="mt-0.5 text-xs text-muted">{[r.symptoms.join(", "), r.note].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => run(deleteReaction(r.id!).then(() => notify("Reaction deleted")))}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted active:bg-soft"
                aria-label="Delete reaction"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {logging ? (
        <ReactionForm
          dateKey={entry.date}
          onCancel={() => setLogging(false)}
          onSave={async (values) => {
            await logReaction({ ...values, foodId, entryId: entry.id });
            setLogging(false);
            notify("Reaction logged");
          }}
        />
      ) : (
        <Button type="button" variant="secondary" className="w-full" onClick={() => setLogging(true)}>
          <Icon name="flame" className="h-4 w-4" /> Log reaction
        </Button>
      )}
    </section>
  );
}

function TriggerNote({ initial, onSave }: { initial: string; onSave: (note: string) => void }) {
  const [note, setNote] = useState(initial);
  return (
    <input
      className={inputClass}
      value={note}
      placeholder="Note (optional) — e.g. only on an empty stomach"
      onChange={(e) => setNote(e.target.value)}
      onBlur={() => note !== initial && onSave(note)}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

function ReactionForm({
  dateKey,
  onSave,
  onCancel,
}: {
  dateKey: string;
  onSave: (v: { at: number; severity: Severity; symptoms: string[]; note?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [time, setTime] = useState(() => defaultReactionTime(dateKey));
  const [severity, setSeverity] = useState<Severity>(2);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (s: string) => setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const at = new Date(time).getTime();

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <p className="font-semibold">Log reaction</p>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-muted">When</span>
        <input type="datetime-local" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <div>
        <span className="mb-1 block text-sm font-medium text-muted">How bad</span>
        <SeverityPicker value={severity} onChange={setSeverity} />
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium text-muted">Symptoms (optional)</span>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={symptoms.includes(s)}
              onClick={() => toggle(s)}
              className={cx(
                "h-8 rounded-full px-3 text-sm font-medium",
                symptoms.includes(s) ? "bg-ink text-bg" : "bg-soft text-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
      {error && <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          type="button"
          disabled={saving || !Number.isFinite(at)}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await onSave({ at, severity, symptoms, note });
            } catch (e) {
              setError(`Couldn't save: ${(e as Error)?.message ?? e}`);
              setSaving(false);
            }
          }}
        >
          Save reaction
        </Button>
      </div>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-8 w-14 shrink-0 rounded-full transition", checked ? "bg-ink" : "bg-soft")}
    >
      <span
        className={cx(
          "absolute top-1 left-1 h-6 w-6 rounded-full bg-card shadow transition-transform",
          checked && "translate-x-6",
        )}
      />
    </button>
  );
}
