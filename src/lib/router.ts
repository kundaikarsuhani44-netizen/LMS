import { useSyncExternalStore } from "react";

/*
  Tiny hash router. Routes are plain words joined by hyphens (e.g. #course-c1-classwork)
  so a link to any screen can be copied and shared.
*/
export type Route =
  | { name: "home" }
  | { name: "courses" }
  | { name: "course"; id: string; tab: string }
  | { name: "assignment"; id: string }
  | { name: "exams" }
  | { name: "exam"; id: string }
  | { name: "results" }
  | { name: "roster" }
  | { name: "people" }
  | { name: "privacy" }
  | { name: "audit" }
  | { name: "brand" };

export function parse(hash: string): Route {
  const [name, a, b] = hash.replace(/^#/, "").split("-");
  switch (name) {
    case "courses": case "exams": case "results": case "roster": case "people": case "privacy": case "audit": case "brand":
      return { name };
    case "course": return a ? { name: "course", id: a, tab: b || "stream" } : { name: "courses" };
    case "assignment": return a ? { name: "assignment", id: a } : { name: "home" };
    case "exam": return a ? { name: "exam", id: a } : { name: "exams" };
    default: return { name: "home" };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case "course": return `#course-${r.id}-${r.tab}`;
    case "assignment": return `#assignment-${r.id}`;
    case "exam": return `#exam-${r.id}`;
    default: return `#${r.name}`;
  }
}

export function go(r: Route) {
  const h = href(r);
  if (location.hash !== h) location.hash = h;
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (l) => { window.addEventListener("hashchange", l); return () => window.removeEventListener("hashchange", l); },
    () => location.hash,
  );
  return parse(hash);
}
