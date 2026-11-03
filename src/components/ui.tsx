"use client";

import { ReactNode, useEffect } from "react";
import {
  ArrowClockwise,
  Barcode,
  BookOpenText,
  BowlFood,
  Camera,
  CaretLeft,
  CaretRight,
  ChatCircleDots,
  Check,
  ClockCounterClockwise,
  Coffee,
  CookingPot,
  DownloadSimple,
  Drop,
  Fire,
  Footprints,
  GearSix,
  MagnifyingGlass,
  Minus,
  Notepad,
  OrangeSlice,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Scales,
  Scan,
  Sneaker,
  Sparkle,
  SunHorizon,
  Trash,
  UploadSimple,
  X,
  type Icon as PhosphorIcon,
  type IconWeight,
} from "@phosphor-icons/react";

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
      <div className="animate-sheet relative mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[2rem] bg-bg shadow-2xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3">
          <h2 className="font-display text-[22px] leading-tight font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft text-muted"
            aria-label="Close"
          >
            <Icon name="close" weight="bold" className="h-4 w-4" />
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

/* ---------- Screen header ---------- */

export function ScreenHeader({
  title,
  subtitle,
  action,
  onBack,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/90 px-5 pb-3 backdrop-blur-xl">
      {onBack && (
        <button
          onClick={onBack}
          className="-ml-2 mb-1 flex h-9 items-center gap-1 rounded-full pr-3 pl-1 text-sm font-medium text-brand active:bg-soft"
          aria-label="Back"
        >
          <Icon name="left" weight="bold" className="h-4 w-4" /> Today
        </button>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[2rem] leading-tight font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 pb-1">{action}</div>}
      </div>
    </header>
  );
}

/** Small pill button for header actions ("New chat", "New plan"). */
export const headerActionClass =
  "h-9 rounded-full bg-card px-4 text-sm font-medium text-ink active:scale-95 disabled:opacity-0";

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
        "inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 font-semibold transition active:scale-[0.98] disabled:opacity-40",
        variant === "primary" && "bg-brand text-on-brand",
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
  "h-12 w-full rounded-xl border border-line bg-card px-3 text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20";

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
    <div className="flex rounded-full bg-soft p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full font-medium transition",
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
  color = "var(--brand)",
  track = "var(--soft)",
  overColor = "var(--accent)",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  overColor?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? overColor : color}
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

export function Bar({
  value,
  max,
  color,
  track = "var(--soft)",
}: {
  value: number;
  max: number;
  color: string;
  track?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: track }}>
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

/* ---------- Icons (Phosphor) ---------- */

const ICONS = {
  close: X,
  plus: Plus,
  minus: Minus,
  left: CaretLeft,
  right: CaretRight,
  settings: GearSix,
  barcode: Barcode,
  label: Scan,
  sparkle: Sparkle,
  pencil: PencilSimple,
  clock: ClockCounterClockwise,
  camera: Camera,
  drop: Drop,
  trash: Trash,
  check: Check,
  download: DownloadSimple,
  upload: UploadSimple,
  flame: Fire,
  scale: Scales,
  plan: Notepad,
  chat: ChatCircleDots,
  book: BookOpenText,
  send: PaperPlaneTilt,
  activity: Sneaker,
  refresh: ArrowClockwise,
  today: SunHorizon,
  search: MagnifyingGlass,
  steps: Footprints,
  // meals
  breakfast: Coffee,
  lunch: BowlFood,
  dinner: CookingPot,
  snack: OrangeSlice,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className,
  style,
  weight = "regular",
}: {
  name: IconName | string;
  className?: string;
  style?: React.CSSProperties;
  weight?: IconWeight;
}) {
  const C = ICONS[name as IconName];
  if (!C) return null;
  return <C weight={weight} style={style} className={cx("h-5 w-5 shrink-0", className)} aria-hidden />;
}

export const MACRO_META = [
  { key: "protein", label: "Protein", short: "P", color: "var(--protein)", onHero: "var(--protein-hi)" },
  { key: "carbs", label: "Carbs", short: "C", color: "var(--carbs)", onHero: "var(--carbs-hi)" },
  { key: "fat", label: "Fat", short: "F", color: "var(--fat)", onHero: "var(--fat-hi)" },
  { key: "fibre", label: "Fibre", short: "Fi", color: "var(--fibre)", onHero: "var(--fibre-hi)" },
] as const;

/** Compact macro readout: coloured letter + amount, no separators. */
export function MacroLine({ n, className }: { n: { protein: number; carbs: number; fat: number; fibre: number }; className?: string }) {
  return (
    <span className={cx("tabular inline-flex gap-2.5", className)}>
      {MACRO_META.map((m) => (
        <span key={m.key} className="whitespace-nowrap">
          <span className="font-semibold" style={{ color: m.color }}>
            {m.short}
          </span>{" "}
          {Math.round(n[m.key])}
        </span>
      ))}
    </span>
  );
}

/** Small card section used across screens. */
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className={cx("rounded-[1.375rem] bg-card p-5", className)}>
      {children}
    </section>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-8 w-14 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-soft")}
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
