import Anthropic from "@anthropic-ai/sdk";
import { MODEL, TruncatedReplyError, anthropic, describeError, guard, quickThinking } from "@/lib/server/ai";
import { MealPlan, PlanTargets, calorieWindow, checkPlan, normalisePlan } from "@/lib/plan";

export const maxDuration = 60;

type Turn = { role: "user" | "assistant"; content: string };

interface Body {
  /** e.g. "Tuesday 3 November" */
  dayLabel?: string;
  targets?: PlanTargets;
  /** Conversation so far: first user turn is the original request */
  messages?: Turn[];
  /** The current plan when refining */
  plan?: MealPlan | null;
  /** Only present when the user shares reflux triggers */
  triggers?: string[];
}

function system(t: PlanTargets, dayLabel: string, triggers: string[]) {
  const { min, max } = calorieWindow(t);
  return `You plan one day of meals for the user of a personal calorie tracking app in the UK.

HARD RULE: the day's total must be between ${min} and ${max} kcal (their calorie-deficit goal is ${max}). Never above ${max}. The app adds up your items and rejects plans outside this range, so do the arithmetic carefully.
Daily targets: protein ${t.protein} g, carbs ${t.carbs} g, fat ${t.fat} g, fibre ${t.fibre} g. Get protein and fibre as close to target as you can.

The day: ${dayLabel}.
- Breakfast, lunch, dinner and usually one snack (use the "snack" meal for any snacks), unless they ask otherwise.
- Use the ingredients and preferences they mention. Realistic UK supermarket foods, home-cookable, with specific portions in grams/ml or household measures.
- Each meal: a short title, a one or two sentence method, and its components as separate items with portion and nutrition for that portion (kcal, protein, carbs, fat, fibre in g; UK/AOAC fibre). Be accurate; use standard nutrition values.
- Never below ${t.floor} kcal, no crash-diet tactics, no skipped meals as a strategy.${
    triggers.length
      ? `\n- Avoid these foods, which give them reflux: ${triggers.join("; ")}.`
      : ""
  }

When refining: change only what they ask for (plus whatever is needed to stay within ${min}–${max} kcal), keep the rest.

Reply with ONLY a JSON object, no other text:
{"message":"one or two short sentences to the user about the plan or what you changed","plan":{"meals":[{"meal":"breakfast","title":"...","method":"...","items":[{"name":"...","portion":"...","kcal":0,"protein":0,"carbs":0,"fat":0,"fibre":0}]}],"notes":"optional short tip"}}`;
}

function parse(text: string) {
  const raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return { message: String(raw?.message ?? "").slice(0, 600), plan: normalisePlan(raw?.plan) };
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const t = body.targets;
  if (!t || !(t.kcal > 0) || !(t.floor > 0)) {
    return Response.json({ error: "Set your calorie goal in Goals & settings first." }, { status: 400 });
  }
  const turns = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns.at(-1)!.role !== "user") {
    return Response.json({ error: "Describe the plan you'd like." }, { status: 400 });
  }
  const triggers = Array.isArray(body.triggers) ? body.triggers.filter((x) => typeof x === "string").slice(0, 60) : [];

  // The current plan rides along with the latest request when refining.
  const messages: Anthropic.MessageParam[] = turns.map((m, i) =>
    i === turns.length - 1 && body.plan
      ? { role: "user", content: `Current plan:\n${JSON.stringify(body.plan)}\n\n${m.content}` }
      : m,
  );

  const client = anthropic();
  const sys = system(t, String(body.dayLabel || "tomorrow").slice(0, 60), triggers);
  try {
    let lastGood: { message: string; plan: MealPlan } | null = null;
    // First attempt + up to 2 repairs if the totals land outside the window (or the JSON is bad).
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await client.messages.create({ model: MODEL, max_tokens: 6000, ...quickThinking(), system: sys, messages });
      if (res.stop_reason === "max_tokens") throw new TruncatedReplyError();
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      let parsed: { message: string; plan: MealPlan };
      try {
        parsed = parse(text);
      } catch {
        console.error("plan: unparseable reply", text.slice(0, 1500));
        messages.push({ role: "assistant", content: text }, { role: "user", content: "That wasn't valid JSON in the required shape. Reply with only the JSON object." });
        continue;
      }
      const check = checkPlan(parsed.plan, t);
      if (check.within) return Response.json({ ...parsed, check, attempts: attempt + 1 });
      lastGood = parsed;
      messages.push(
        { role: "assistant", content: text },
        {
          role: "user",
          content: `${check.problem} Adjust portions or swap items so the total is between ${check.min} and ${check.max} kcal, keeping what I asked for. Recalculate each item's numbers. Reply with only the JSON object.`,
        },
      );
    }
    if (lastGood) {
      // Still outside the window: return it flagged, so the app can block logging.
      return Response.json({ ...lastGood, check: checkPlan(lastGood.plan, t), attempts: 3 });
    }
    throw new SyntaxError("No valid plan");
  } catch (err) {
    console.error("plan failed", err);
    return Response.json({ error: describeError(err, MODEL) }, { status: 502 });
  }
}
