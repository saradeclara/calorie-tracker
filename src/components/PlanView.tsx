"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { requestPlan } from "@/lib/api";
import { addDays, todayKey } from "@/lib/dates";
import { calorieWindow, type PlanTargets } from "@/lib/plan";
import { PLAN_KEY, dayLabel, logPlan, planTargets, planTurn, savePlan, sharedTriggers, type StoredPlan } from "@/lib/planner";
import { useFoodIndex } from "@/lib/useFoods";
import { MEALS } from "@/lib/types";
import { Bar, Button, Icon, Segmented, Spinner, cx } from "./ui";
import { TriggerWarning } from "./Reflux";

const EXAMPLE =
  "Meal plan for tomorrow. I want to use mango yoghurt, mature cheddar, fresh basa fillets and Maris Piper potatoes. High fibre and high protein.";

export function PlanView({ notify }: { notify: (m: string) => void }) {
  const stored = useLiveQuery(() => db.settings.get(PLAN_KEY).then((r) => (r?.value as StoredPlan | null) ?? null), []);
  const [targets, setTargets] = useState<PlanTargets | null>(null);
  const [day, setDay] = useState<"today" | "tomorrow">("tomorrow");
  const [prompt, setPrompt] = useState("");
  const [refine, setRefine] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const foods = useFoodIndex();

  useEffect(() => {
    planTargets().then(setTargets);
  }, []);

  useEffect(() => {
    if (busy) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [busy, stored?.chat.length]);

  if (stored === undefined || !targets) return null;
  const win = calorieWindow(targets);

  /** Create (no stored plan) or refine (stored plan) via the API. */
  const run = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setSlow(false);
    setError("");
    const slowTimer = window.setTimeout(() => setSlow(true), 15_000);
    const date = stored ? stored.date : day === "today" ? todayKey() : addDays(todayKey(), 1);
    const chat = [...(stored?.chat ?? []), planTurn("user", q)];
    try {
      const fresh = await planTargets(); // goals may have changed since the tab opened
      setTargets(fresh);
      const res = await requestPlan({
        dayLabel: dayLabel(date),
        targets: fresh,
        messages: chat.map(({ role, content }) => ({ role, content })),
        plan: stored?.plan ?? null,
        triggers: await sharedTriggers(),
      });
      await savePlan({
        date,
        plan: res.plan,
        check: res.check,
        chat: [...chat, planTurn("assistant", res.message || "Here's your plan.")],
        // A changed plan hasn't been logged yet.
        loggedAt: undefined,
      });
      setPrompt("");
      setRefine("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      window.clearTimeout(slowTimer);
      setBusy(false);
    }
  };

  const busyNote = (
    <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted">
      <Spinner className="h-4 w-4" />
      {stored ? "Updating your plan…" : "Planning your day…"}
      {slow && " Still checking it fits your calories."}
    </div>
  );

  /* ---------- No plan yet ---------- */
  if (!stored) {
    return (
      <div className="pb-28">
        <Header />
        <div className="space-y-3 px-4">
          <section className="space-y-3 rounded-3xl bg-card p-5 shadow-sm">
            <Segmented
              size="sm"
              value={day}
              onChange={setDay}
              options={[
                { id: "today", label: "Today" },
                { id: "tomorrow", label: "Tomorrow" },
              ]}
            />
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder={EXAMPLE}
              aria-label="What should the plan include?"
              className="w-full resize-none rounded-2xl border border-line bg-bg p-4 text-ink outline-none placeholder:text-muted/70 focus:border-ink/40"
            />
            <p className="text-xs text-muted">
              Always fits your deficit: <b className="tabular text-ink">{win.min}–{win.max} kcal</b> (your goal is {targets.kcal}),
              aiming for {targets.protein} g protein and {targets.fibre} g fibre. Change these in Goals & settings.
            </p>
            {error && <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>}
            {busy ? (
              busyNote
            ) : (
              <Button className="w-full" disabled={!prompt.trim()} onClick={() => run(prompt)}>
                <Icon name="sparkle" /> Create plan
              </Button>
            )}
            {!prompt && (
              <button onClick={() => setPrompt(EXAMPLE)} className="w-full text-center text-xs text-muted underline">
                Use the example
              </button>
            )}
          </section>
        </div>
      </div>
    );
  }

  /* ---------- Plan ---------- */
  const { plan, check } = stored;
  const t = check.totals;

  return (
    <div className="pb-[calc(9.5rem+env(safe-area-inset-bottom))]">
      <Header
        action={
          <button
            onClick={() => {
              if (window.confirm("Start a new plan? This one will be cleared.")) savePlan(null);
            }}
            className="py-2 text-sm font-medium text-muted"
          >
            New plan
          </button>
        }
      />
      <div className="space-y-3 px-4">
        <p className="px-1 text-sm font-medium text-muted">{dayLabel(stored.date)}</p>

        <section className="space-y-3 rounded-3xl bg-card p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="tabular text-2xl font-bold">
              {t.kcal} <span className="text-sm font-normal text-muted">/ {check.max} kcal</span>
            </span>
            {check.within ? (
              <span className="flex items-center gap-1 text-sm font-medium text-protein">
                <Icon name="check" className="h-4 w-4" /> Within your deficit
              </span>
            ) : (
              <span className="text-sm font-medium text-accent">Outside your target</span>
            )}
          </div>
          {!check.within && check.problem && (
            <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">
              {check.problem} Ask for a change below to fix it. Logging is off until it fits.
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            <Macro label="Protein" value={t.protein} target={targets.protein} color="var(--protein)" />
            <Macro label="Fibre" value={t.fibre} target={targets.fibre} color="var(--fibre)" />
            <Macro label="Carbs" value={t.carbs} target={targets.carbs} color="var(--carbs)" />
            <Macro label="Fat" value={t.fat} target={targets.fat} color="var(--fat)" />
          </div>
        </section>

        {plan.meals.map((m, mi) => {
          const kcal = Math.round(m.items.reduce((a, i) => a + i.kcal, 0));
          return (
            <section key={mi} className="rounded-3xl bg-card p-5 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">
                    {MEALS.find((x) => x.id === m.meal)?.label}
                  </div>
                  <h3 className="font-semibold leading-snug">{m.title}</h3>
                </div>
                <span className="tabular shrink-0 font-semibold">{kcal}</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {m.items.map((i, ii) => {
                  const trig = foods.trigger({ name: i.name });
                  return (
                    <li key={ii} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <span>
                          {i.name}
                          {i.portion && <span className="text-muted"> · {i.portion}</span>}
                        </span>
                        <span className="tabular shrink-0 text-muted">{Math.round(i.kcal)}</span>
                      </div>
                      {trig && <TriggerWarning food={trig} compact />}
                    </li>
                  );
                })}
              </ul>
              {m.method && <p className="mt-2 text-sm text-muted">{m.method}</p>}
            </section>
          );
        })}
        {plan.notes && <p className="px-1 text-sm text-muted">{plan.notes}</p>}

        <Button
          className="w-full"
          disabled={!check.within || busy}
          variant={stored.loggedAt ? "secondary" : "primary"}
          onClick={async () => {
            if (stored.loggedAt && !window.confirm("This plan is already in your log. Add it again?")) return;
            try {
              await logPlan(stored);
              notify(`Plan logged to ${dayLabel(stored.date).replace(/ \(.*\)$/, "")}`);
            } catch (e) {
              notify(`Couldn't log: ${(e as Error)?.message ?? e}`);
            }
          }}
        >
          <Icon name={stored.loggedAt ? "check" : "plus"} className="h-4 w-4" />
          {stored.loggedAt ? "Logged · log again" : `Log whole plan to ${dayLabel(stored.date).split(" ")[0]}`}
        </Button>

        {/* Refine chat */}
        <section className="space-y-2 pt-2">
          <h2 className="px-1 text-sm font-semibold text-muted">Refine</h2>
          {stored.chat.map((c, i) => (
            <div key={i} className={cx("flex", c.role === "user" ? "justify-end" : "justify-start")}>
              <p
                className={cx(
                  "max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-sm",
                  c.role === "user" ? "rounded-br-lg bg-ink text-bg" : "rounded-bl-lg bg-card shadow-sm",
                )}
              >
                {c.content}
              </p>
            </div>
          ))}
          {busy && busyNote}
          {error && <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>}
          <div ref={endRef} />
        </section>
      </div>

      <form
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-bg/95 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          run(refine);
        }}
      >
        <div className="mx-auto flex max-w-lg items-end gap-2 px-4 py-2">
          <textarea
            value={refine}
            onChange={(e) => setRefine(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run(refine);
              }
            }}
            rows={Math.min(4, Math.max(1, refine.split("\n").length))}
            placeholder="Change something…"
            aria-label="Refine the plan"
            disabled={busy}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-card px-4 py-2.5 text-ink outline-none placeholder:text-muted/70 focus:border-ink/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!refine.trim() || busy}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-bg disabled:opacity-30"
            aria-label="Send"
          >
            {busy ? <Spinner className="h-4 w-4" /> : <Icon name="send" className="h-5 w-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function Header({ action }: { action?: React.ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 flex items-center justify-between bg-bg/90 px-4 pb-2 backdrop-blur">
      <span className="w-20" />
      <h1 className="py-2 text-lg font-semibold">Meal plan</h1>
      <span className="flex w-20 justify-end">{action}</span>
    </header>
  );
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular text-muted">
          <span className="text-ink">{Math.round(value)}</span>/{target}g
        </span>
      </div>
      <Bar value={value} max={target} color={color} />
    </div>
  );
}
