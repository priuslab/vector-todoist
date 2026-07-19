import { useCallback, useEffect, useMemo, useState } from "react";

const safeRead = (key) => {
  try { return JSON.parse(window.localStorage.getItem(key) || "null"); } catch { return null; }
};
const safeWrite = (key, value) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing */ }
};

export function usePersistentTimer({ durationMinutes = 50, storageKey = "vector-focus-timer" } = {}) {
  const initial = useMemo(() => {
    const saved = typeof window !== "undefined" ? safeRead(storageKey) : null;
    if (saved && ["active", "paused", "finished"].includes(saved.status)) return saved;
    const now = Date.now();
    return { status: "active", durationMinutes, startedAt: now, endAt: now + durationMinutes * 60_000, pausedAt: null, pausedSeconds: 0, finishedAt: null };
  }, [durationMinutes, storageKey]);
  const [snapshot, setSnapshot] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { safeWrite(storageKey, snapshot); }, [snapshot, storageKey]);
  useEffect(() => {
    if (snapshot.status !== "active") return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [snapshot.status]);
  const pause = useCallback(() => setSnapshot((current) => current.status === "active" ? { ...current, status: "paused", pausedAt: Date.now() } : current), []);
  const resume = useCallback(() => setSnapshot((current) => {
    if (current.status !== "paused" || !current.pausedAt) return current;
    const added = Math.max(0, Date.now() - current.pausedAt);
    return { ...current, status: "active", pausedAt: null, endAt: current.endAt + added, pausedSeconds: current.pausedSeconds + Math.floor(added / 1000) };
  }), []);
  const finish = useCallback(() => setSnapshot((current) => {
    if (current.status === "finished") return current;
    const finishedAt = Date.now();
    const currentPause = current.status === "paused" && current.pausedAt ? Math.max(0, Math.floor((finishedAt - current.pausedAt) / 1000)) : 0;
    return { ...current, status: "finished", finishedAt, pausedAt: null, pausedSeconds: current.pausedSeconds + currentPause };
  }), []);
  const reset = useCallback(() => { const startedAt = Date.now(); setSnapshot({ status: "active", durationMinutes, startedAt, endAt: startedAt + durationMinutes * 60_000, pausedAt: null, pausedSeconds: 0, finishedAt: null }); }, [durationMinutes]);
  const hydrate = useCallback((server) => {
    if (!server?.startedAt || !server?.plannedEndAt) return;
    setSnapshot((current) => ({ ...current, status: server.status === "paused" ? "paused" : "active", startedAt: Date.parse(server.startedAt), endAt: Date.parse(server.plannedEndAt), pausedAt: server.pausedAt ? Date.parse(server.pausedAt) : null, pausedSeconds: Number(server.pausedSeconds || 0), finishedAt: server.finishedAt ? Date.parse(server.finishedAt) : null, durationMinutes: Number(server.plannedMinutes || current.durationMinutes) }));
  }, []);
  const remainingSeconds = snapshot.status === "paused" ? Math.max(0, Math.ceil((snapshot.endAt - (snapshot.pausedAt || now)) / 1000)) : Math.max(0, Math.ceil((snapshot.endAt - now) / 1000));
  const elapsedMinutes = Math.max(0, Math.round(((snapshot.finishedAt || now) - snapshot.startedAt - snapshot.pausedSeconds * 1000) / 60_000 * 10) / 10);
  return { ...snapshot, remainingSeconds, elapsedMinutes, pause, resume, finish, reset, hydrate, isComplete: remainingSeconds === 0 || snapshot.status === "finished" };
}

export function formatTimer(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
