import { MODEL, anthropic, describeError, guard, quickThinking } from "@/lib/server/ai";

export const maxDuration = 60;

const SYSTEM = `You are a friendly, practical nutrition, fitness and weight-loss coach inside the user's personal calorie tracking app. The user is in the UK.

You get a snapshot of their day (food logged, totals vs goals, calories left, water, Garmin steps and workouts, weight trend, their calorie goal) with each message. Use it: answer about their actual day, with their actual numbers. Don't recite the snapshot back.

How to answer:
- Short and phone-friendly: a few sentences or a short bullet list. Plain language. No tables, no headings.
- Be specific: real foods with amounts and approximate kcal/protein, using UK supermarket items.
- When suggesting food, fit it to what they have left today (calories and protein especially).
- Explain the "why" briefly when it helps them decide.
- Warm and direct; encouraging without cheerleading or guilt. Never moralise about food.

Safety:
- Never recommend eating below their calorie floor (1200 kcal/day for women, 1500 for men), crash diets, skipping meals as a strategy, or exercising to "earn" or "burn off" food.
- Losing faster than ~1% of body weight a week isn't something to push for.
- You're not a doctor or dietitian. For medical questions, symptoms, medications, pregnancy, or anything concerning, suggest they speak to their GP.
- If something they say suggests disordered eating or real distress, respond with care, don't give numbers or targets, and gently suggest talking to their GP or Beat (the UK eating disorder charity).
- If the snapshot is missing something you need, say what you're assuming.`;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { messages?: Msg[]; context?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Last 20 turns, alternating, starting with the user (the API requires that).
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length || history[history.length - 1].role !== "user") {
    return Response.json({ error: "Ask the coach something." }, { status: 400 });
  }

  // The day snapshot rides along with the latest question.
  const context = String(body.context ?? "").slice(0, 8000);
  const last = history[history.length - 1];
  last.content = `<my_day>\n${context}\n</my_day>\n\n${last.content}`;

  const encoder = new TextEncoder();
  const stream = anthropic().messages.stream({
    model: MODEL,
    max_tokens: 2048,
    ...quickThinking(),
    system: SYSTEM,
    messages: history,
  });

  const body$ = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (t) => controller.enqueue(encoder.encode(t)));
      stream
        .finalMessage()
        .then((m) => {
          if (m.stop_reason === "max_tokens") controller.enqueue(encoder.encode("\n\n_(reply cut short)_"));
          controller.close();
        })
        .catch((err) => {
          console.error("coach failed", err);
          // Errors after streaming started can't change the status, so send a marker the app recognises.
          controller.enqueue(encoder.encode(`\n\u0000ERROR:${describeError(err, MODEL)}`));
          controller.close();
        });
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body$, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
