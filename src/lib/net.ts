import { useSyncExternalStore } from "react";

/*
  Connection state = the browser's real online flag AND a demo switch that simulates
  a campus WiFi drop, so exam resilience can be shown without unplugging anything.
*/
let simulatedOffline = false;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());
if (typeof window !== "undefined") {
  window.addEventListener("online", emit);
  window.addEventListener("offline", emit);
}

export function setSimulatedOffline(v: boolean) {
  simulatedOffline = v;
  emit();
}

export function isOnline() {
  return !simulatedOffline && (typeof navigator === "undefined" || navigator.onLine !== false);
}

export function useNet() {
  const online = useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, isOnline);
  const simulated = useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => simulatedOffline);
  return { online, simulated };
}
