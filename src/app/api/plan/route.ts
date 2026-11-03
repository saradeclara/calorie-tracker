import Anthropic from "@anthropic-ai/sdk";
import { MODEL, TruncatedReplyError, anthropic, describeError, guard, quickThinking } from "@/lib/server/ai";
import { MealPlan, PlanKit, PlanTargets, applyKits, calorieWindow, checkPlan, normalisePlan } from "@/lib/plan";

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
  /** Saved meal-kit recipes the user ticked for this plan */
  kits?: PlanKit[];
}

function system(t: PlanTargets, dayLabel: string, triggers: string[], kits: PlanKit[]) {
  const { min, max } = calorieWindow(t);
  return `You plan one day of meals for the user of a personal calorie tracking app in the UK.

HARD RULE: the day's total must be between ${min} and ${max} kcal (their calorie-deficit goal is ${max}). Never above ${max}. The app adds up your items and rejects plans outside this range, so do the arithmetic carefully.
Daily targets: protein ${t.protein} g, carbs ${t.carbs} g, fat ${t.fat} g, fibre ${t.fibre} g. Get protein and fibre as close to target as you can.

The day: ${dayLabel}.
- Breakfast, lunch, dinner and usually one snack (use the "snack" meal for any snacks), unless they ask otherwise.
- Use the ingredients and preferences they mention. Realistic UK supermarket foods, home-cookable, with specific portions in grams/ml or household measures.
- Each meal: a short title, a method (2 to 5 short sentences in order, enough to cook it from; one sentence is fine for no-cook meals), and its components as separate items with portion and nutrition for that portion (kcal, protein, carbs, fat, fibre in g; UK/AOAC fibre). Be accurate; use standard nutrition values.
- Never below ${t.floor} kcal, no crash-diet tactics, no skipped meals as a strategy.${
    triggers.length
      ? `\n- Avoid these foods, which give them reflux: ${triggers.join("; ")}.`
      : ""
  }${
    kits.length
      ? `\n\nSaved meals they want included (meal kits, ready meals or packaged food, with exact nutrition from the pack/card for the portion shown). Include EACH exactly once, as a single item with its "kitId", the name and portion as given, in the most sensible meal slot (main meals at lunch/dinner, snacks as snacks). These numbers are fixed; plan everything else around them:\n${kits
          .map((k) => `- kitId ${k.id}: ${k.brand ? `${k.brand} · ` : ""}${k.name} (${k.portion || "1 serving"}): ${k.kcal} kcal, protein ${k.protein} g, carbs ${k.carbs} g, fat ${k.fat} g, fibre ${k.fibre} g`)
          .join("\n")}\nAdd sides around a saved meal only if they fit.`
      : ""
  }

When refining: change only what they ask for (plus whatever is needed to stay within ${min}–${max} kcal), keep the rest.

Reply with ONLY a JSON object, no other text:
{"message":"one or two short sentences to the user about the plan or what you changed","plan":{"meals":[{"meal":"breakfast","title":"...","method":"...","items":[{"name":"...","portion":"...","kcal":0,"protein":0,"carbs":0,"fat":0,"fibre":0}]}],"notes":"optional short tip"}}
(Kit items also have "kitId": <number>.)`;
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
  const kits: PlanKit[] = (Array.isArray(body.kits) ? body.kits : [])
    .filter((k) => Number.isInteger(k?.id) && typeof k.name === "string" && Number(k.kcal) > 0)
    .slice(0, 4)
    .map((k) => ({ id: k.id, name: k.name.slice(0, 120), brand: k.brand?.slice(0, 40), portion: k.portion?.slice(0, 80), kcal: +k.kcal, protein: +k.protein || 0, carbs: +k.carbs || 0, fat: +k.fat || 0, fibre: +k.fibre || 0 }));
  const kitKcal = kits.reduce((a, k) => a + k.kcal, 0);
  if (kitKcal > calorieWindow(t).max) {
    return Response.json(
      { error: `Your ticked meals add up to ${Math.round(kitKcal)} kcal, more than your ${calorieWindow(t).max} kcal goal on their own. Untick one.` },
      { status: 400 },
    );
  }

  // The current plan rides along with the latest request when refining.
  const messages: Anthropic.MessageParam[] = turns.map((m, i) =>
    i === turns.length - 1 && body.plan
      ? { role: "user", content: `Current plan:\n${JSON.stringify(body.plan)}\n\n${m.content}` }
      : m,
  );

  const client = anthropic();
  const sys = system(t, String(body.dayLabel || "tomorrow").slice(0, 60), triggers, kits);
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
      // Kit items get the card's numbers before anything is checked.
      const kitted = applyKits(parsed.plan, kits);
      parsed = { ...parsed, plan: kitted.plan };
      const check = checkPlan(parsed.plan, t);
      if (check.within && !kitted.missing.length) return Response.json({ ...parsed, check, attempts: attempt + 1 });
      lastGood = parsed;
      const problems = [
        kitted.missing.length ? `These saved meals are missing and must each be included once, as an item with its kitId: ${kitted.missing.join("; ")}.` : "",
        check.within ? "" : `${check.problem} (Saved meals count at their pack/card values, which can't change.)`,
      ].filter(Boolean);
      messages.push(
        { role: "assistant", content: text },
        {
          role: "user",
          content: `${problems.join(" ")} Fix this so the total is between ${check.min} and ${check.max} kcal, keeping what I asked for. Recalculate each non-kit item's numbers. Reply with only the JSON object.`,
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
