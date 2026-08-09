import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  /// Sprungmarke, damit ein Hinweis anderswo hierher verweisen kann.
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <header className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{children}</h2>
      {hint ? <p className="mt-1 text-sm text-slate-600">{hint}</p> : null}
    </header>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

const BADGE_TONES = {
  neutral: "bg-slate-100 text-slate-700",
  good: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-800",
  bad: "bg-red-100 text-red-800",
  info: "bg-sky-100 text-sky-800",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/// Hinweiskasten — wird vor allem genutzt, um ehrlich zu erklaeren,
/// was eine Plattform technisch nicht hergibt.
export function Notice({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children?: ReactNode;
  tone?: "info" | "warn";
}) {
  const styles =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-sky-300 bg-sky-50 text-sky-900";
  return (
    <div className={`rounded-lg border p-4 text-sm ${styles}`}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 leading-relaxed">{children}</div> : null}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8">
      {back ? (
        <Link
          href={back.href}
          className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800"
        >
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-slate-600">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

export function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });
}
