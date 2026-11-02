import { connection, type NextRequest } from "next/server";
import { guardPasscode } from "@/lib/server/ai";
import { GarminError, garminConfigured, garminGet } from "@/lib/server/garmin";
import type { GarminDay } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : null;
};

const pretty = (key: string) => key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export async function GET(request: NextRequest) {
  // Always run at request time: the answer depends on server env, so it must never be prerendered.
  await connection();
  // "Not set up" reveals nothing, so answer it before the passcode check (avoids a pointless error).
  if (!garminConfigured()) return Response.json({ configured: false } satisfies GarminDay);
  const denied = guardPasscode(request);
  if (denied) return denied;

  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Bad date." }, { status: 400 });

  try {
    const [stats, list] = await Promise.all([
      garminGet<any>("/usersummary-service/usersummary/daily", { calendarDate: date }),
      garminGet<any[]>("/activitylist-service/activities/search/activities", {
        start: 0,
        limit: 30,
        startDate: date,
        endDate: date,
      }),
    ]);

    const activities = (Array.isArray(list) ? list : []).map((a: any) => {
      const type = (a?.activityType ?? a?.activityTypeDTO ?? {})?.typeKey ?? "";
      return {
        id: String(a?.activityId ?? ""),
        name: String(a?.activityName || pretty(type) || "Activity").slice(0, 80),
        type: String(type),
        minutes: Math.round((num(a?.duration) ?? num(a?.movingDuration) ?? 0) / 60),
        kcal: Math.round(num(a?.calories) ?? 0),
        start: String(a?.startTimeLocal ?? ""),
      };
    });

    const body: GarminDay = {
      configured: true,
      activeKcal: num(stats?.activeKilocalories),
      totalKcal: num(stats?.totalKilocalories),
      steps: num(stats?.totalSteps),
      stepGoal: num(stats?.dailyStepGoal),
      activities,
    };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("garmin failed", err);
    const e = err instanceof GarminError ? err : new GarminError("Couldn't reach Garmin. Try again.");
    return Response.json({ error: e.message }, { status: e.status });
  }
}
