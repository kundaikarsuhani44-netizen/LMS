import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const rtf = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });

export function relTime(t: number, now = Date.now()) {
  const diff = t - now;
  const abs = Math.abs(diff);
  const m = 60_000, h = 60 * m, d = 24 * h;
  if (abs < m) return "just now";
  if (abs < h) return rtf.format(Math.round(diff / m), "minute");
  if (abs < d) return rtf.format(Math.round(diff / h), "hour");
  if (abs < 14 * d) return rtf.format(Math.round(diff / d), "day");
  return fmtDate(t);
}

export function fmtDate(t: number) {
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(t: number) {
  return new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function initials(name: string) {
  return name.replace(/^(Prof\.|Dr\.)\s*/, "").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function pad(n: number) {
  return String(n).padStart(2, "0");
}
