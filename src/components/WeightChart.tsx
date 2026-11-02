"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fromKey } from "@/lib/dates";
import type { TrendPoint } from "@/lib/weight";

const H = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 40 };
const DAY = 86_400_000;

const fmtDay = (key: string) => fromKey(key).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Daily weigh-ins (dots) with the 7-day average (line). Crosshair tooltip on hover/touch. */
export function WeightChart({ points }: { points: TrendPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const t = points.map((p) => fromKey(p.date).getTime());
    const t0 = t[0];
    const t1 = Math.max(t[t.length - 1], t0 + 6 * DAY); // at least a week wide
    const vals = points.flatMap((p) => [p.kg, p.avg]);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const span = Math.max(hi - lo, 2); // at least 2 kg tall so small wobbles don't look dramatic
    const mid = (hi + lo) / 2;
    lo = Math.floor((mid - span / 2 - 0.3) * 2) / 2;
    hi = Math.ceil((mid + span / 2 + 0.3) * 2) / 2;
    const iw = width - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (ms: number) => PAD.left + ((ms - t0) / (t1 - t0)) * iw;
    const y = (kg: number) => PAD.top + (1 - (kg - lo) / (hi - lo)) * ih;
    const step = hi - lo > 6 ? 2 : hi - lo > 3 ? 1 : 0.5;
    const ticks: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
    return { xs: t.map(x), y, ticks, iw };
  }, [points, width]);

  const line = points.map((p, i) => `${i ? "L" : "M"}${geo.xs[i].toFixed(1)},${geo.y(p.avg).toFixed(1)}`).join("");
  const h = hover !== null ? points[hover] : null;

  const pick = (clientX: number) => {
    const rect = wrap.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    geo.xs.forEach((x, i) => Math.abs(x - px) < Math.abs(geo.xs[best] - px) && (best = i));
    setHover(best);
  };

  return (
    <div>
      {/* Legend: two marks of the same measure, told apart by shape as well as colour */}
      <div className="mb-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="4" fill="var(--w-dot)" /></svg>
          Daily weigh-in
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="10" aria-hidden><path d="M1 5h14" stroke="var(--w-line)" strokeWidth="2" strokeLinecap="round" /></svg>
          7-day average
        </span>
      </div>

      <div
        ref={wrap}
        className="relative touch-pan-y select-none"
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <svg width={width} height={H} role="img" aria-label={`Weight chart, ${points.length} weigh-ins`}>
          {geo.ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.left - 6} y={geo.y(v)} dy="0.32em" textAnchor="end" className="tabular fill-[var(--muted)] text-[11px]">
                {v % 1 ? v.toFixed(1) : v}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={H - 6} className="fill-[var(--muted)] text-[11px]">{fmtDay(points[0].date)}</text>
          {points.length > 1 && (
            <text x={width - PAD.right} y={H - 6} textAnchor="end" className="fill-[var(--muted)] text-[11px]">
              {fmtDay(points[points.length - 1].date)}
            </text>
          )}

          {h && <line x1={geo.xs[hover!]} x2={geo.xs[hover!]} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth="1" />}

          {points.map((p, i) => (
            <circle key={p.date} cx={geo.xs[i]} cy={geo.y(p.kg)} r={hover === i ? 5.5 : 4} fill="var(--w-dot)" stroke="var(--card)" strokeWidth="2" />
          ))}
          {points.length > 1 && <path d={line} fill="none" stroke="var(--w-line)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        </svg>

        {h && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-xl bg-ink px-3 py-2 text-xs text-bg shadow-lg"
            style={{
              left: Math.min(Math.max(geo.xs[hover!] - 60, 0), width - 128),
              width: 128,
            }}
            role="status"
          >
            <div className="opacity-75">{fmtDay(h.date)}</div>
            <div className="tabular text-sm font-semibold">{h.kg.toFixed(1)} kg</div>
            <div className="tabular opacity-75">7-day avg {h.avg.toFixed(1)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
