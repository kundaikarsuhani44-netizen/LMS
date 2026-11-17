import { useEffect, type ReactNode } from "react";
import { BookOpen, GraduationCap, Home, ShieldCheck, Upload, Users, ScrollText, Palette, WifiOff, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDB, useSession, setRole, userById, resetDemo } from "../lib/store";
import { href, type Route } from "../lib/router";
import { useNet } from "../lib/net";
import type { Role } from "../lib/types";
import { cn } from "../lib/utils";
import { Avatar } from "./ui";

interface NavItem { label: string; icon: LucideIcon; route: Route; match: Route["name"][] }

const NAV: Record<Role, NavItem[]> = {
  student: [
    { label: "Home", icon: Home, route: { name: "home" }, match: ["home"] },
    { label: "Courses", icon: BookOpen, route: { name: "courses" }, match: ["courses", "course", "assignment"] },
    { label: "Exams", icon: Timer, route: { name: "exams" }, match: ["exams", "exam"] },
    { label: "Results", icon: GraduationCap, route: { name: "results" }, match: ["results"] },
    { label: "My data", icon: ShieldCheck, route: { name: "privacy" }, match: ["privacy"] },
  ],
  faculty: [
    { label: "Home", icon: Home, route: { name: "home" }, match: ["home"] },
    { label: "Courses", icon: BookOpen, route: { name: "courses" }, match: ["courses", "course", "assignment"] },
    { label: "Exams", icon: Timer, route: { name: "exams" }, match: ["exams", "exam"] },
  ],
  admin: [
    { label: "Overview", icon: Home, route: { name: "home" }, match: ["home"] },
    { label: "Courses", icon: BookOpen, route: { name: "courses" }, match: ["courses", "course", "assignment"] },
    { label: "Roster import", icon: Upload, route: { name: "roster" }, match: ["roster"] },
    { label: "People", icon: Users, route: { name: "people" }, match: ["people"] },
    { label: "Data & privacy", icon: ShieldCheck, route: { name: "privacy" }, match: ["privacy"] },
    { label: "Audit log", icon: ScrollText, route: { name: "audit" }, match: ["audit"] },
    { label: "Branding", icon: Palette, route: { name: "brand" }, match: ["brand"] },
  ],
};

const ROLE_LABEL: Record<Role, string> = { student: "Student", faculty: "Faculty", admin: "Admin" };

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const db = useDB();
  const session = useSession();
  const me = userById(db, session.userId)!;
  const { online } = useNet();
  const items = NAV[session.role];
  const examMode = route.name === "exam" && session.role === "student";

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-h", String(db.settings.brandHue));
  }, [db.settings.brandHue]);

  return (
    <div className="min-h-full">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lg">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      {!examMode && (
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border bg-surface lg:flex" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <Brand name={db.settings.shortName} />
          <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
            <ul className="grid gap-0.5">
              {items.map((it) => {
                const active = it.match.includes(route.name);
                return (
                  <li key={it.label}>
                    <a
                      href={href(it.route)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-primary-soft text-primary-text" : "text-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      <it.icon size={18} aria-hidden />
                      {it.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="border-t border-border p-3">
            <DemoSwitcher role={session.role} />
          </div>
        </aside>
      )}

      <div className={cn(!examMode && "lg:pl-60")}>
        {/* Top bar */}
        <header
          className="sticky z-10 border-b border-border bg-surface/95 backdrop-blur"
          style={{ top: "env(safe-area-inset-top, 0px)", paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
        >
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 lg:px-4">
            <div className={cn("lg:hidden", examMode && "lg:block")}>
              <Brand name={db.settings.shortName} compact />
            </div>
            <p className="hidden min-w-0 truncate text-sm text-muted sm:block">{db.settings.institution}</p>
            <div className="ml-auto flex items-center gap-3">
              {!online && (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-warning-soft px-2 py-1 text-xs font-semibold text-warning">
                  <WifiOff size={14} aria-hidden /> Offline
                </span>
              )}
              <div className="lg:hidden"><DemoSwitcher role={session.role} compact /></div>
              <div className="flex items-center gap-2">
                <Avatar name={me.name} />
                <div className="hidden leading-tight md:block">
                  <p className="text-sm font-semibold">{me.name}</p>
                  <p className="text-xs text-muted">{me.rollNo ?? ROLE_LABEL[session.role]}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto max-w-6xl pb-28 pt-6 outline-none lg:px-4 lg:pb-12"
          style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
        >
          {children}
        </main>
      </div>

      {/* Phone bottom bar */}
      {!examMode && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}
        >
          <ul className="flex overflow-x-auto">
            {items.map((it) => {
              const active = it.match.includes(route.name);
              return (
                <li key={it.label} className="min-w-16 flex-1">
                  <a
                    href={href(it.route)}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-semibold", active ? "text-primary-text" : "text-muted")}
                  >
                    <it.icon size={20} aria-hidden />
                    <span className="truncate">{it.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

function Brand({ name, compact }: { name: string; compact?: boolean }) {
  return (
    <a href="#home" className={cn("flex items-center gap-2.5", !compact && "px-5 py-5")}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden className="shrink-0">
        <rect width="28" height="28" rx="6" fill="var(--primary)" />
        {/* Two river bends: the Mandovi */}
        <path d="M6 10c4 0 4 4 8 4s4-4 8-4" stroke="var(--primary-fg)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M6 17c4 0 4 4 8 4s4-4 8-4" stroke="var(--primary-fg)" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />
      </svg>
      <span className="leading-none">
        <span className="block font-display text-[17px] font-bold tracking-tight">Mandovi</span>
        {!compact && <span className="mt-1 block text-xs text-muted">{name} · Learning</span>}
      </span>
    </a>
  );
}

function DemoSwitcher({ role, compact }: { role: Role; compact?: boolean }) {
  return (
    <div className={cn(!compact && "grid gap-2")}>
      {!compact && <p className="eyebrow">Demo · view as</p>}
      <label className="sr-only" htmlFor={compact ? "role-compact" : "role-full"}>View the demo as</label>
      <select
        id={compact ? "role-compact" : "role-full"}
        value={role}
        onChange={(e) => { setRole(e.target.value as Role); location.hash = "#home"; }}
        className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm font-medium"
      >
        <option value="student">Student</option>
        <option value="faculty">Faculty</option>
        <option value="admin">Admin</option>
      </select>
      {!compact && (
        <button type="button" onClick={() => resetDemo()} className="text-left text-xs text-muted underline-offset-2 hover:underline">
          Reset demo data
        </button>
      )}
    </div>
  );
}

