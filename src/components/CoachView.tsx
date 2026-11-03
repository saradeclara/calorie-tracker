"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, logEntry, setSetting } from "@/lib/db";
import { RecipeToggle } from "./RecipeView";
import { askCoach, buildCoachContext, chatMessage, parseReply, type ChatMessage, type Suggestion } from "@/lib/coach";
import { useGarminDay } from "@/lib/garmin";
import { mealForNow, todayKey } from "@/lib/dates";
import { useFoodIndex } from "@/lib/useFoods";
import { MEALS } from "@/lib/types";
import { Icon, MacroLine, ScreenHeader, Spinner, cx, headerActionClass } from "./ui";
import { Markdownish } from "./Markdownish";
import { TriggerWarning } from "./Reflux";

const STARTERS = [
  "How am I doing today?",
  "Suggest a high-protein snack that fits what I've got left",
  "What should I have for dinner?",
  "Did today's activity earn me extra food?",
];

const KEY = "coachChat";

export function CoachView({ notify }: { notify: (m: string) => void }) {
  const [today] = useState(() => todayKey());
  const garmin = useGarminDay(today);
  const saved = useLiveQuery(() => db.settings.get(KEY).then((r) => (r?.value as ChatMessage[]) ?? []), []);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const shareReflux = useLiveQuery(() => db.settings.get("coachShareReflux").then((r) => !!r?.value), []);
  // Which suggestions have been logged this session, keyed "messageAt:index".
  const [logged, setLogged] = useState<Record<string, boolean>>({});

  const logSuggestion = async (key: string, s: Suggestion) => {
    const meal = mealForNow();
    try {
      await logEntry({ ...s, source: "ai", date: todayKey(), meal });
      setLogged((l) => ({ ...l, [key]: true }));
      notify(`Added to ${MEALS.find((m) => m.id === meal)?.label ?? "today"}`);
    } catch (e) {
      notify(`Couldn't save: ${(e as Error)?.message ?? e}`);
    }
  };
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const list = messages ?? saved ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [list.length, streaming]);

  const persist = (msgs: ChatMessage[]) => setSetting(KEY, msgs.slice(-40));

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || streaming !== null) return;
    setError("");
    setDraft("");
    const next = [...list, chatMessage("user", q)];
    setMessages(next);
    persist(next);
    setStreaming("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const context = await buildCoachContext(garmin.data);
      const reply = await askCoach(next, context, setStreaming, ctrl.signal);
      const done = [...next, chatMessage("assistant", reply || "…")];
      setMessages(done);
      persist(done);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        // Keep whatever had arrived.
        setStreaming((partial) => {
          if (partial) {
            const done = [...next, chatMessage("assistant", `${partial}\n\n_(stopped)_`)];
            setMessages(done);
            persist(done);
          }
          return null;
        });
        return;
      }
      setError((e as Error).message);
    } finally {
      abortRef.current = null;
      setStreaming(null);
    }
  };

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    persist([]);
    setError("");
  };

  return (
    <div className="pb-[calc(9.5rem+env(safe-area-inset-bottom))]">
      <ScreenHeader
        title="Coach"
        action={
          <button onClick={newChat} disabled={list.length === 0} className={headerActionClass}>
            New chat
          </button>
        }
      />

      <div className="space-y-3 px-4">
        {list.length === 0 && streaming === null && (
          <div className="space-y-4 pt-4">
            <div className="rounded-[1.375rem] bg-card p-5 text-sm">
              <p className="font-semibold">Your nutrition & fitness coach</p>
              <p className="mt-1 text-muted">
                Ask about today&apos;s food, your activity, snack ideas or your weight trend. It sees today&apos;s log, goals,
                water, Garmin activity and weight{shareReflux ? ", and your reflux triggers" : ", but not your reflux triggers (you can share them in Goals & settings)"}.
                Food it suggests can be logged with one tap. It&apos;s not medical advice.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-2xl bg-soft px-4 py-2.5 text-left text-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {list.map((m, i) => (
          <Bubble
            key={`${m.at}-${i}`}
            role={m.role}
            text={m.content}
            loggedKeys={logged}
            keyPrefix={String(m.at)}
            onLog={logSuggestion}
          />
        ))}
        {streaming !== null &&
          (streaming ? (
            <Bubble role="assistant" text={streaming} />
          ) : (
            <div className="flex items-center gap-2 px-1 text-sm text-muted">
              <Spinner className="h-4 w-4" /> Looking at your day…
            </div>
          ))}
        {error && <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>}
        <div ref={endRef} />
      </div>

      {/* Composer, above the tab bar */}
      <form
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-bg/95 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="mx-auto flex max-w-lg items-end gap-2 px-4 py-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={Math.min(4, Math.max(1, draft.split("\n").length))}
            placeholder="Ask your coach…"
            aria-label="Message"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-card px-4 py-2.5 text-ink outline-none placeholder:text-muted/70 focus:border-ink/40"
          />
          {streaming !== null ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft text-ink"
              aria-label="Stop"
            >
              <span className="h-3.5 w-3.5 rounded-sm bg-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-30"
              aria-label="Send"
            >
              <Icon name="send" className="h-5 w-5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Bubble({
  role,
  text,
  keyPrefix,
  loggedKeys,
  onLog,
}: {
  role: ChatMessage["role"];
  text: string;
  keyPrefix?: string;
  loggedKeys?: Record<string, boolean>;
  onLog?: (key: string, s: Suggestion) => void;
}) {
  const { display, suggestions } = role === "assistant" ? parseReply(text) : { display: text, suggestions: [] };
  return (
    <div className={cx("flex flex-col", role === "user" ? "items-end" : "items-start")}>
      <div
        className={cx(
          "max-w-[85%] rounded-[1.375rem] px-4 py-3 text-[15px] leading-relaxed",
          role === "user" ? "rounded-br-lg bg-brand text-on-brand" : "rounded-bl-lg bg-card",
        )}
      >
        {role === "assistant" ? <Markdownish text={display} /> : <p className="whitespace-pre-wrap">{display}</p>}
      </div>
      {suggestions.length > 0 && onLog && (
        <ul className="mt-2 w-full space-y-2" aria-label="Suggestions you can log">
          {suggestions.map((sg, i) => (
            <SuggestionCard key={i} s={sg} done={!!loggedKeys?.[`${keyPrefix}:${i}`]} onLog={() => onLog(`${keyPrefix}:${i}`, sg)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SuggestionCard({ s, done, onLog }: { s: Suggestion; done: boolean; onLog: () => void }) {
  const foods = useFoodIndex();
  // App-side name match only (no AI): same warning as everywhere else.
  const trig = foods.triggers.find((t) => t.name.trim().toLowerCase() === s.name.trim().toLowerCase());
  return (
    <li className="flex items-start gap-3 rounded-[1.375rem] bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug">{s.name}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-xs text-muted">
          {s.portion && <span>{s.portion}</span>}
          <span className="tabular font-semibold text-ink">{s.kcal} kcal</span>
          <MacroLine n={s} />
        </div>
        {trig && <TriggerWarning food={trig} compact />}
        {s.recipe && <RecipeToggle recipe={s.recipe} />}
      </div>
      <button
        onClick={onLog}
        disabled={done}
        className={cx(
          "flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold",
          done ? "bg-soft text-muted" : "bg-brand text-on-brand active:scale-95",
        )}
        aria-label={done ? `${s.name} logged` : `Log ${s.name}`}
      >
        <Icon name={done ? "check" : "plus"} className="h-4 w-4" />
        {done ? "Logged" : "Log"}
      </button>
    </li>
  );
}
