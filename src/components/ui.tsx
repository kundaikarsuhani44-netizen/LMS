import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn, initials } from "../lib/utils";

/* Button ------------------------------------------------------------------ */

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 rounded-md select-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover",
        secondary: "bg-surface text-fg border border-border-strong hover:bg-surface-2",
        ghost: "text-fg hover:bg-surface-2",
        danger: "bg-danger text-primary-fg hover:opacity-90",
        link: "text-primary-text underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, icon: Icon, children, type = "button", ...rest }, ref) => (
  <button ref={ref} type={type} className={cn(buttonStyles({ variant, size }), className)} {...rest}>
    {Icon && <Icon size={16} aria-hidden />}
    {children}
  </button>
));

/* Surfaces ---------------------------------------------------------------- */

export function Card({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" | "li" } & Record<string, unknown>) {
  return <As className={cn("rounded-lg border border-border bg-surface shadow-card", className)} {...rest}>{children}</As>;
}

export function PageHeader({ eyebrow, title, actions, children }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children && <div className="mt-1 text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

/* Badge ------------------------------------------------------------------- */

const badgeStyles = cva("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-surface-2 text-muted",
      brand: "bg-primary-soft text-primary-text",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ tone, icon: Icon, children, className }: VariantProps<typeof badgeStyles> & { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn(badgeStyles({ tone }), className)}>
      {Icon && <Icon size={12} aria-hidden />}
      {children}
    </span>
  );
}

/* Form controls ----------------------------------------------------------- */

const fieldBase = "w-full rounded-md border border-border-strong bg-surface px-3 text-fg placeholder:text-muted/80 aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => (
  <input ref={ref} className={cn(fieldBase, "h-10", className)} {...rest} />
));
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "min-h-28 py-2 leading-relaxed", className)} {...rest} />
));
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "h-10 pr-8", className)} {...rest}>{children}</select>;
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">{label}</label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* Tabs (WAI-ARIA tabs pattern, arrow-key navigation) ---------------------- */

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1">
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
                onChange(next.id);
                requestAnimationFrame(() => document.getElementById(`tab-${next.id}`)?.focus());
              }
            }}
            className={cn(
              "relative -mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
              active ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t.label}
            {t.count != null && <span className="ml-1.5 tnum text-xs font-medium text-muted">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* Empty state ------------------------------------------------------------- */

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
      <Icon size={28} className="mb-3 text-muted" aria-hidden />
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* Avatar ------------------------------------------------------------------ */

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-text"
    >
      {initials(name)}
    </span>
  );
}

/* Notice ------------------------------------------------------------------ */

const noticeStyles = cva("flex gap-3 rounded-md border px-4 py-3 text-sm", {
  variants: {
    tone: {
      info: "border-border bg-surface-2 text-fg",
      success: "border-success/30 bg-success-soft text-fg",
      warning: "border-warning/40 bg-warning-soft text-fg",
      danger: "border-danger/40 bg-danger-soft text-fg",
    },
  },
  defaultVariants: { tone: "info" },
});

export function Notice({ tone, icon: Icon, title, children, className }: VariantProps<typeof noticeStyles> & { icon?: LucideIcon; title?: string; children?: ReactNode; className?: string }) {
  const iconColor = { info: "text-muted", success: "text-success", warning: "text-warning", danger: "text-danger" }[tone ?? "info"];
  return (
    <div className={cn(noticeStyles({ tone }), className)} role={tone === "danger" ? "alert" : undefined}>
      {Icon && <Icon size={18} className={cn("mt-0.5 shrink-0", iconColor)} aria-hidden />}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-muted" : ""}>{children}</div>}
      </div>
    </div>
  );
}

/* Responsive data list: a table on wide screens, cards at phone width ------ */

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Hide in the phone card layout (e.g. redundant with the title). */
  hideOnCard?: boolean;
  primary?: boolean;
}

export function DataList<T>({ rows, columns, rowKey, caption, empty }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; caption: string; empty?: ReactNode }) {
  if (!rows.length && empty) return <>{empty}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-border last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 align-middle", c.align === "right" && "text-right tnum", c.align === "center" && "text-center")}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-2 md:hidden" aria-label={caption}>
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-2 font-semibold">{primary.cell(r)}</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {columns.filter((c) => c !== primary && !c.hideOnCard).map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-muted">{c.header}</dt>
                  <dd className="min-w-0 text-right tnum">{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

/* Toast ------------------------------------------------------------------- */

type ToastMsg = { id: number; text: string; tone: "success" | "info" | "danger" };
let pushToast: (t: Omit<ToastMsg, "id">) => void = () => {};
export const toast = (text: string, tone: ToastMsg["tone"] = "success") => pushToast({ text, tone });

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { ...t, id }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4000);
    };
  }, []);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}
    >
      {items.map((t) => (
        <div key={t.id} className={cn("pointer-events-auto rounded-md px-4 py-2.5 text-sm font-medium shadow-lg", t.tone === "danger" ? "bg-danger text-primary-fg" : "bg-fg text-bg")}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* Progress meter ---------------------------------------------------------- */

export function Meter({ value, max = 100, tone = "brand", label }: { value: number; max?: number; tone?: "brand" | "success" | "warning" | "danger"; label: string }) {
  const color = { brand: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label} className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}
