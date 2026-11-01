"use client";

import { Food, SEVERITIES, Severity, severityLabel } from "@/lib/types";
import { Icon, cx } from "./ui";

export const SEVERITY_COLOR: Record<Severity, string> = {
  1: "var(--mild)",
  2: "var(--moderate)",
  3: "var(--severe)",
};

export function SeverityChip({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cx("inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold", className)}
      style={{ color: SEVERITY_COLOR[severity], background: `color-mix(in srgb, ${SEVERITY_COLOR[severity]} 14%, transparent)` }}
    >
      {severityLabel(severity)}
    </span>
  );
}

export function SeverityPicker({ value, onChange }: { value: Severity; onChange: (s: Severity) => void }) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Severity">
      {SEVERITIES.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={value === s.id}
          onClick={() => onChange(s.id)}
          className={cx(
            "h-10 flex-1 rounded-xl text-sm font-semibold transition",
            value === s.id ? "text-white" : "bg-soft text-muted",
          )}
          style={value === s.id ? { background: SEVERITY_COLOR[s.id] } : undefined}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** Small marker shown next to logged items that are known triggers. */
export function TriggerDot({ food }: { food: Food }) {
  const sev = food.triggerSeverity ?? 1;
  return (
    <span title={`Reflux trigger · ${severityLabel(sev)}`} aria-label={`Reflux trigger, ${severityLabel(sev)}`} style={{ color: SEVERITY_COLOR[sev] }}>
      <Icon name="flame" className="h-4 w-4" />
    </span>
  );
}

/** Non-blocking warning shown when you're about to add a known trigger. */
export function TriggerWarning({ food, compact }: { food: Food; compact?: boolean }) {
  const sev = food.triggerSeverity ?? 1;
  return (
    <div
      className={cx("flex items-start gap-1.5 rounded-lg text-xs font-medium", compact ? "mt-1" : "mt-2 p-2")}
      style={{
        color: SEVERITY_COLOR[sev],
        background: compact ? undefined : `color-mix(in srgb, ${SEVERITY_COLOR[sev]} 12%, transparent)`,
      }}
      role="note"
    >
      <Icon name="flame" className="h-3.5 w-3.5 shrink-0 translate-y-px" />
      <span>
        Known reflux trigger ({severityLabel(sev).toLowerCase()})
      </span>
    </div>
  );
}
