"use client";

import { ReactNode, useEffect } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- Bottom sheet ---------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button
        aria-label="Close"
        className="animate-fade absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="animate-sheet relative mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-bg shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-soft text-muted"
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5">
          {children}
          {/* keeps the end of the content clear of the iPhone home indicator */}
          {!footer && <div className="pb-safe" aria-hidden />}
        </div>
        {footer && <div className="pb-safe border-t border-line px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Action bar that stays pinned to the bottom of a Sheet while its content scrolls,
 * padded clear of the iPhone home indicator.
 */
export function StickyActions({ children, error }: { children: ReactNode; error?: string }) {
  return (
    <div className="pb-safe sticky bottom-0 z-10 -mx-5 mt-3 border-t border-line bg-bg px-5 pt-3">
      {error && <p className="mb-2 rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>}
      {children}
    </div>
  );
}

/* ---------- Buttons & inputs ---------- */

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition active:scale-[0.98] disabled:opacity-40",
        variant === "primary" && "bg-ink text-bg",
        variant === "secondary" && "bg-soft text-ink",
        variant === "ghost" && "text-muted",
        variant === "danger" && "bg-accent/10 text-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-12 w-full rounded-xl border border-line bg-card px-3 text-ink outline-none placeholder:text-muted/70 focus:border-ink/40";

export function NumberInput({
  value,
  onChange,
  suffix,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | "";
  onChange: (v: number | "") => void;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        {...props}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className={cx(inputClass, "tabular", suffix && "pr-12")}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { id: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex rounded-2xl bg-soft p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl font-medium transition",
            size === "sm" ? "h-8 text-sm" : "h-10 text-[15px]",
            value === o.id ? "bg-card text-ink shadow-sm" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Progress ---------- */

export function Ring({
  value,
  max,
  size = 148,
  stroke = 14,
  color = "var(--accent)",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--ink)" : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color, transition: "width 0.5s ease" }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      aria-hidden
    />
  );
}

/* ---------- Icons (inline, no dependency) ---------- */

const PATHS: Record<string, ReactNode> = {
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  barcode: <path d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12M3 4h3M18 4h3M3 20h3M18 20h3" />,
  sparkle: <path d="M12 3l1.8 4.9L19 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  drop: <path d="M12 3c3.5 4.5 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 2.5-6.5 6-11z" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  check: <path d="M5 12l5 5 9-10" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  upload: <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />,
  flame: <path d="M12 3c.5 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.4 2-4.5.2 1.6 1 2.6 2 3 0-3.2-.8-5.8.5-8.5z" />,
  scale: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M8.5 9.5a5 5 0 0 1 7 0M12 9.5l1.5-2" />
    </>
  ),
  plan: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4V5z" />,
  send: <path d="M4 12l16-8-6 16-3-7-7-1z" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  today: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
};

export function Icon({
  name,
  className,
  style,
}: {
  name: keyof typeof PATHS | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      style={style}
      viewBox="0 0 24 24"
      className={cx("h-5 w-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

export const MACRO_META = [
  { key: "protein", label: "Protein", color: "var(--protein)" },
  { key: "carbs", label: "Carbs", color: "var(--carbs)" },
  { key: "fat", label: "Fat", color: "var(--fat)" },
  { key: "fibre", label: "Fibre", color: "var(--fibre)" },
] as const;

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
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
