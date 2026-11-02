import { db, getGoals, getSetting } from "./db";
import { addDays, todayKey } from "./dates";
import { Profile, calculate } from "./deficit";
import { adjustmentFor } from "./garmin";
import { sum } from "./nutrition";
import { withTrend } from "./weight";
import { MEALS, type GarminBurn, type GarminDay } from "./types";

export type ChatMessage = { role: "user" | "assistant"; content: string; at: number };

const r = (n: number) => Math.round(n);

/**
 * Plain-text snapshot of today for the coach. Deliberately excludes the reflux trigger list
 * (Sara wants no AI involvement in reflux) and anything not needed to answer.
 */
export async function buildCoachContext(garmin?: GarminDay | null): Promise<string> {
  const date = todayKey();
  const now = new Date();
  const [goals, entries, water, weights, profile, burn] = await Promise.all([
    getGoals(),
    db.entries.where("date").equals(date).sortBy("createdAt"),
    db.water.where("date").equals(date).toArray(),
    db.weights.where("date").aboveOrEqual(addDays(date, -28)).toArray(),
    getSetting<Partial<Profile> | null>("deficitProfile", null),
    getSetting<GarminBurn | null>("garminBurn", null),
  ]);

  const lines: string[] = [];
  lines.push(`Now: ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`);

  const full = profile && Number(profile.age) > 0 && Number(profile.heightCm) > 0 && Number(profile.weightKg) > 0;
  const adj = garmin?.configured && full ? adjustmentFor(garmin.activeKcal, profile as Profile, burn) : null;
  const bonus = adj?.adjustment ?? 0;

  if (full) {
    const c = calculate(profile as Profile, burn);
    lines.push(
      `About me: ${profile!.sex}, ${profile!.age}y, ${profile!.heightCm} cm. Goal: ${profile!.lossKgPerWeek ? `lose ${profile!.lossKgPerWeek} kg/week` : "maintain"}. ` +
        `Maintenance ~${c.maintenance} kcal (${c.source === "garmin" ? "Garmin average burn" : "estimated from activity level"}). Calorie floor ${c.floor}.`,
    );
  }

  const eaten = sum(entries);
  const budget = goals.kcal + bonus;
  lines.push(
    `Today's goals: ${goals.kcal} kcal${bonus ? ` + ${bonus} Garmin bonus = ${budget}` : ""}, protein ${goals.protein} g, carbs ${goals.carbs} g, fat ${goals.fat} g, fibre ${goals.fibre} g, water ${goals.waterMl} ml.`,
  );
  lines.push(
    `Eaten so far: ${r(eaten.kcal)} kcal, protein ${r(eaten.protein)} g, carbs ${r(eaten.carbs)} g, fat ${r(eaten.fat)} g, fibre ${r(eaten.fibre)} g. ` +
      `Left: ${r(budget - eaten.kcal)} kcal, protein ${r(goals.protein - eaten.protein)} g, fibre ${r(goals.fibre - eaten.fibre)} g.`,
  );

  if (entries.length) {
    lines.push("Food logged today:");
    for (const m of MEALS) {
      const items = entries.filter((e) => e.meal === m.id);
      if (items.length) {
        lines.push(`- ${m.label}: ${items.map((e) => `${e.name}${e.portion ? ` (${e.portion})` : ""} ${r(e.kcal)} kcal, ${r(e.protein)} g protein`).join("; ")}`);
      }
    }
  } else {
    lines.push("Food logged today: nothing yet.");
  }

  lines.push(`Water: ${water.reduce((a, w) => a + w.ml, 0)} ml.`);

  if (garmin?.configured) {
    const acts = (garmin.activities ?? []).map((a) => `${a.name} ${a.minutes} min ${a.kcal} kcal`).join("; ");
    lines.push(
      `Garmin today: ${garmin.steps ?? "?"} steps${garmin.stepGoal ? ` (goal ${garmin.stepGoal})` : ""}, ${garmin.activeKcal ?? "?"} active kcal. Workouts: ${acts || "none"}.` +
        (adj ? ` Bonus calories earned: ${bonus}.` : ""),
    );
  }

  if (weights.length) {
    const t = withTrend(weights);
    const last = t[t.length - 1];
    const first = t[0];
    lines.push(
      `Weight: latest ${last.kg} kg (${last.date}), 7-day average ${last.avg} kg; 7-day average was ${first.avg} kg on ${first.date} (${t.length} weigh-ins in the last 4 weeks).`,
    );
  }

  return lines.join("\n");
}

/** Stream a coach reply. Calls onText with the growing reply. */
export async function askCoach(
  messages: ChatMessage[],
  context: string,
  onText: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const passcode = await getSetting<string>("passcode", "");
  let res: Response;
  try {
    res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-passcode": passcode },
      body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })), context }),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new Error("Couldn't reach the server. Check your connection.");
  }
  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    const err = text.indexOf("\u0000ERROR:");
    if (err !== -1) throw new Error(text.slice(err + 7).trim());
    onText(text);
  }
  return text.trim();
}

export const chatMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({ role, content, at: Date.now() });
