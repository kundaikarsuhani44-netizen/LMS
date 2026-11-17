import { useSyncExternalStore } from "react";
import type { DB, Role } from "./types";
import { makeSeed } from "./seed";

/*
  Prototype persistence layer.
  In this prototype the "server" is the browser's localStorage, so the app runs anywhere
  with no backend. Every mutation goes through `mutate`, which is the single seam where a
  real API (hosted in an Indian region) plugs in. Audit entries are written here, so no
  screen can change data without leaving a trail.
*/

const KEY = "mandovi:db:v1";
const SESSION_KEY = "mandovi:session:v1";

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: run in memory */ }
}

function load(): DB {
  const raw = safeGet(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === 1) return parsed;
    } catch { /* corrupt: reseed */ }
  }
  return makeSeed();
}

let db: DB = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// No hyphens: ids appear in URLs like #assignment-<id>.
export const uid = (p = "id") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function getDB() { return db; }

export function mutate(fn: (draft: DB) => void, audit?: { actorId: string; action: string; detail: string }) {
  const next: DB = structuredClone(db);
  fn(next);
  if (audit) next.audit.unshift({ id: uid("au"), at: Date.now(), ...audit });
  db = next;
  safeSet(KEY, JSON.stringify(db));
  emit();
}

export function resetDemo() {
  db = makeSeed();
  safeSet(KEY, JSON.stringify(db));
  emit();
}

export function useDB(): DB {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => db,
  );
}

/* ---------- session (who is signed in, for the demo role switcher) ---------- */

export interface Session { role: Role; userId: string }
const DEFAULT_USER: Record<Role, string> = { student: "s1", faculty: "f1", admin: "a1" };

let session: Session = (() => {
  try {
    const s = JSON.parse(safeGet(SESSION_KEY) || "null");
    if (s && s.role && s.userId) return s as Session;
  } catch { /* ignore */ }
  return { role: "student", userId: "s1" };
})();
const sessionListeners = new Set<() => void>();

export function setRole(role: Role) {
  session = { role, userId: DEFAULT_USER[role] };
  safeSet(SESSION_KEY, JSON.stringify(session));
  sessionListeners.forEach((l) => l());
}

export function useSession(): Session {
  return useSyncExternalStore(
    (l) => { sessionListeners.add(l); return () => sessionListeners.delete(l); },
    () => session,
  );
}

/* ---------- selectors ---------- */

export const userById = (d: DB, id: string) => d.users.find((u) => u.id === id);
export const courseById = (d: DB, id: string) => d.courses.find((c) => c.id === id);

export function coursesFor(d: DB, s: Session) {
  if (s.role === "admin") return d.courses;
  if (s.role === "faculty") return d.courses.filter((c) => c.facultyId === s.userId);
  return d.courses.filter((c) => c.enrolled.includes(s.userId));
}
