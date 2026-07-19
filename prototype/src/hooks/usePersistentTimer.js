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
  const finish = useCallback(() => setSnapshot((current) => current.status === "finished" ? current : { ...current, status: "finished", finishedAt: Date.now() }), []);
  const reset = useCallback(() => { const startedAt = Date.now(); setSnapshot({ status: "active", durationMinutes, startedAt, endAt: startedAt + durationMinutes * 60_000, pausedAt: null, pausedSeconds: 0, finishedAt: null }); }, [durationMinutes]);
  const remainingSeconds = snapshot.status === "paused" ? Math.max(0, Math.ceil((snapshot.endAt - (snapshot.pausedAt || now)) / 1000)) : Math.max(0, Math.ceil((snapshot.endAt - now) / 1000));
  const elapsedMinutes = Math.max(0, Math.round(((snapshot.finishedAt || now) - snapshot.startedAt - snapshot.pausedSeconds * 1000) / 60_000 * 10) / 10);
  return { ...snapshot, remainingSeconds, elapsedMinutes, pause, resume, finish, reset, isComplete: remainingSeconds === 0 || snapshot.status === "finished" };
}

export function formatTimer(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
