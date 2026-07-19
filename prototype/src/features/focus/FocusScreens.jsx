import { CheckCircle, Pause, Play, Stop, Bell } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { DEMO_TASKS } from "../../data/demoData";
import { formatTimer, usePersistentTimer } from "../../hooks/usePersistentTimer";
import { finishFocusSession, getActiveFocusSession, pauseFocusSession, resumeFocusSession, startFocusSession } from "./focusApi";

export function FocusScreens({ screenId = "focus-mode", onNavigate = () => {}, mode = "balanced", apiClient, taskId = DEMO_TASKS[0].id || "demo-episode-task", durationMinutes = 50 }) {
  const timer = usePersistentTimer({ durationMinutes, storageKey: `vector-focus:${taskId}` });
  const [sessionId, setSessionId] = useState(null);
  const [sessionResolved, setSessionResolved] = useState(!apiClient || screenId !== "focus-mode");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState("idle");
  useEffect(() => {
    if (!apiClient || screenId !== "focus-mode" || sessionId || !sessionResolved) return;
    const key = `vector-focus-run:${taskId}`;
    let idempotencyKey = window.localStorage.getItem(key);
    if (!idempotencyKey) { idempotencyKey = `${taskId}:${Date.now()}:${Math.random().toString(36).slice(2)}`; window.localStorage.setItem(key, idempotencyKey); }
    startFocusSession({ apiClient, taskId, durationMinutes, idempotencyKey }).then((result) => setSessionId(result?.id || null)).catch(() => {});
  }, [apiClient, durationMinutes, screenId, sessionId, sessionResolved, taskId]);
  useEffect(() => {
    if (!apiClient || screenId !== "focus-mode") return;
    getActiveFocusSession({ apiClient, taskId }).then((result) => { if (result?.id) { setSessionId(result.id); timer.hydrate(result); } }).catch(() => {}).finally(() => setSessionResolved(true));
  }, [apiClient, screenId, taskId]);
  if (screenId === "focus-complete") return <section className="focus-screen focus-screen--complete"><span className="focus-complete-icon"><CheckCircle size={42} weight="duotone" /></span><h1>Фокус-сесію завершено</h1><p>{DEMO_TASKS[0].title}</p><div className="focus-stat"><strong>{Math.round(timer.elapsedMinutes)} хв</strong><span>фактичний час</span></div><p className="focus-note">Задача не позначена виконаною автоматично. Ти вирішуєш сам.</p><h2>Як було?</h2><div className="reflection-pills"><button>Легше, ніж очікувала</button><button>Саме так</button><button>Потрібно більше часу</button></div><Button onClick={() => onNavigate("today-normal")}>Повернутися до дня</Button></section>;
  const togglePause = async () => {
    if (timer.status === "active") { timer.pause(); if (apiClient && sessionId) await pauseFocusSession({ apiClient, sessionId }).catch(() => {}); }
    else if (timer.status === "paused") { timer.resume(); if (apiClient && sessionId) await resumeFocusSession({ apiClient, sessionId }).catch(() => {}); }
  };
  const finish = async () => {
    timer.finish();
    if (apiClient && sessionId) await finishFocusSession({ apiClient, sessionId, completeTask: false }).catch(() => {});
    window.localStorage.removeItem(`vector-focus-run:${taskId}`);
    onNavigate("focus-complete");
  };
  const requestNotifications = async () => {
    if (!("Notification" in window)) { setNotificationStatus("unsupported"); return; }
    try { const permission = await Notification.requestPermission(); setNotificationStatus(permission); } catch { setNotificationStatus("denied"); }
  };
  return <section className="focus-screen" aria-label="Режим фокусу"><button className="focus-close" aria-label="Закрити режим фокусу" onClick={() => onNavigate("today-normal")}><Stop size={19} /></button><span className="focus-label">{mode === "goal_focus" ? "Goal Focus · без відволікань" : "Deep Work · без відволікань"}</span><div className="focus-timer" aria-live="polite">{formatTimer(timer.remainingSeconds)}</div><h1>{DEMO_TASKS[0].title}</h1><p>Один крок за раз. Решта задач почекає.</p><div className="focus-controls"><button aria-label={timer.status === "paused" ? "Продовжити фокус" : "Поставити на паузу"} onClick={togglePause}>{timer.status === "paused" ? <Play size={24} weight="fill" /> : <Pause size={24} weight="fill" />}</button></div><button className="finish-focus" onClick={() => setConfirmFinish(true)}>Завершити сесію</button>{confirmFinish && <div className="focus-confirm" role="dialog" aria-label="Підтвердження завершення"><strong>Завершити зараз?</strong><span>Задача залишиться відкритою — позначиш її виконаною окремо.</span><div><button onClick={finish}>Так, завершити</button><button onClick={() => setConfirmFinish(false)}>Ще попрацювати</button></div></div>}<button className="focus-notifications" onClick={requestNotifications}><Bell size={17} />{notificationStatus === "granted" ? "Нагадування дозволено" : "Дозволити нагадування (необов’язково)"}</button></section>;
}
