import { useEffect, useState } from "react";
import { CheckCircle, Clock, Coffee, Play } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";
import { ProgressRing } from "../../components/Progress";
import { StateView } from "../../components/StateView";
import { TaskCard } from "../../components/TaskCard";
import { UndoSnackbar } from "../../components/UndoSnackbar";
import { DEMO_EVENTS, DEMO_TASKS, DEMO_USER } from "../../data/demoData";
import { EveningReview } from "./EveningReview";
import { TaskTimeSheet } from "./TaskTimeSheet";
import { applyReschedule, completeTask, getToday, previewReschedule, undoChangeSet, updateTask } from "./todayApi";

function localDate(timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function DayPlan({ active = false, onNavigate, completed = false, tasks = DEMO_TASKS, onComplete, onSelect }) {
  const current = tasks[0] ?? DEMO_TASKS[0];
  return (
    <div className="day-plan">
      <div className="now-card"><div><span>{active ? "Зараз · 24 хв залишилось" : "Наступна · 09:30"}</span><h2>{current.title}</h2><small>Deep Work · {current.duration ?? current.estimatedMinutes ?? 60} хв · 94% до мети</small></div><button aria-label="Почати фокус" onClick={() => onNavigate?.("focus-mode")}><Play size={20} weight="fill" /></button></div>
      <div className="timeline-list">
        <span className="timeline-label">Далі</span>
        <TaskCard task={{ ...DEMO_EVENTS[0], duration: 45, alignment: null }} state="locked" />
        {tasks.slice(1).map((task) => { const state = task.status === "completed" || completed ? "completed" : "scheduled"; return <TaskCard key={task.id} task={{ ...task, duration: task.duration ?? task.estimatedMinutes, start: task.start ?? task.plannedStart?.slice(11, 16), end: task.end ?? task.plannedEnd?.slice(11, 16) }} state={state} onComplete={onComplete} onClick={state === "completed" || task.locked ? undefined : () => onSelect?.(task)} />; })}
      </div>
    </div>
  );
}

export function TodayScreens({ screenId = "today-normal", onNavigate = () => {}, apiClient }) {
  const [showUndo, setShowUndo] = useState(screenId === "today-rescheduled");
  const [remote, setRemote] = useState(null);
  const [remoteError, setRemoteError] = useState("");
  const [localTasks, setLocalTasks] = useState(null);
  const [undoChange, setUndoChange] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [reschedulePreview, setReschedulePreview] = useState(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");
  const [rescheduleApplied, setRescheduleApplied] = useState(false);
  const [sheetTask, setSheetTask] = useState(null);
  const [savingTime, setSavingTime] = useState(false);
  const [moveAnnouncement, setMoveAnnouncement] = useState("");
  useEffect(() => { if (!apiClient || !["today-normal", "today-active", "today-overload"].includes(screenId)) return; let alive = true; const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; getToday({ apiClient, date: localDate(timezone), timezone }).then((value) => alive && setRemote(value)).catch(() => alive && setRemoteError("Не вдалося завантажити план. Спробуй оновити сторінку.")); return () => { alive = false; }; }, [apiClient, screenId]);
  const common = { title: "Сьогодні", eyebrow: "П'ятниця, 18 липня", activeRoute: "today-normal", onNavigate, avatar: true };

  if (apiClient && !remote && !remoteError && ["today-normal", "today-active", "today-overload"].includes(screenId)) return <AppFrame {...common}><StateView state="loading" title="Завантажую план" message="Вектор дістає твої задачі та вільні слоти." /></AppFrame>;
  if (apiClient && remoteError && !remote) return <AppFrame {...common}><StateView state="error" title="План тимчасово недоступний" message={remoteError} action={<Button onClick={() => window.location.reload()}>Оновити</Button>} /></AppFrame>;
  if (apiClient && remote && remote.tasks?.length === 0 && ["today-normal", "today-active", "today-overload"].includes(screenId)) return <AppFrame {...common}><StateView state="empty" title="На сьогодні задач ще немає" message="Зроби Brain Dump — Вектор допоможе знайти реалістичний наступний крок." action={<Button onClick={() => onNavigate("capture-chooser")}>Зробити Brain Dump</Button>} /></AppFrame>;

  if (screenId === "evening-review") return <AppFrame {...common}><EveningReview onFinish={() => onNavigate("today-complete")} /></AppFrame>;
  if (screenId === "today-empty") return <AppFrame {...common}><StateView state="empty" title="День ще порожній" message="Вислови все, що в голові, — Вектор складе перший реалістичний план." action={<Button onClick={() => onNavigate("capture-chooser")}>Зробити Brain Dump</Button>} /></AppFrame>;
  if (screenId === "today-complete") return <AppFrame {...common}><StateView state="success" title="На сьогодні достатньо" message="Усі заплановані задачі виконано. Решта може зачекати до завтра." action={<Button onClick={() => onNavigate("evening-review")}>Короткий підсумок</Button>} /></AppFrame>;

  const visibleTasks = localTasks ?? (apiClient ? (remote?.tasks ?? []) : (remote?.tasks?.length ? remote.tasks : DEMO_TASKS));
  const complete = async (id) => {
    const previous = visibleTasks;
    setLocalTasks(previous.map((task) => task.id === id ? { ...task, status: "completed" } : task));
    setMutationError("");
    if (!apiClient) { setUndoChange({ local: true, previous }); return; }
    try { const result = await completeTask({ apiClient, id, idempotencyKey: `today-complete-${id}` }); setLocalTasks((current) => current?.map((task) => task.id === id ? (result.task ?? { ...task, status: "completed" }) : task)); setUndoChange({ id: result.changeSet?.id, previous }); }
    catch { setLocalTasks(previous); setMutationError("Не вдалося виконати задачу. План повернуто до попереднього стану."); }
  };
  const saveTime = async ({ plannedStart, plannedEnd }) => {
    const task = sheetTask;
    if (!task || !apiClient) { setSheetTask(null); return; }
    const previous = visibleTasks;
    const updated = previous
      .map((item) => (item.id === task.id ? { ...item, plannedStart, plannedEnd } : item))
      .sort((a, b) => (a.plannedStart ?? "").localeCompare(b.plannedStart ?? ""));
    setLocalTasks(updated);
    setSheetTask(null);
    setSavingTime(true);
    setMutationError("");
    const patch = { plannedStart, plannedEnd, ...(Number.isInteger(Number(task.version)) ? { expectedVersion: Number(task.version) } : {}) };
    try {
      const result = await updateTask({ apiClient, id: task.id, patch, idempotencyKey: `move-${task.id}-${plannedStart}` });
      const merged = result.task ?? result;
      setLocalTasks((current) => current?.map((item) => (item.id === task.id ? { ...item, ...merged } : item)));
      setMoveAnnouncement(`Задачу перенесено на ${plannedStart.slice(11, 16)}`);
    } catch (error) {
      setLocalTasks(previous);
      if (error?.code === "CONFLICT") {
        setMutationError("Задача змінилася в іншому вікні. Оновлюю план.");
        try {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          const fresh = await getToday({ apiClient, date: localDate(timezone), timezone });
          setRemote(fresh);
          setLocalTasks(fresh.tasks ?? []);
        } catch { /* keep rollback state if refetch also fails */ }
      } else {
        setMutationError("Не вдалося перенести задачу. План повернуто до попереднього стану.");
      }
    } finally {
      setSavingTime(false);
    }
  };
  const undo = async () => {
    if (undoing) return;
    const current = undoChange;
    if (!current) return;
    setUndoing(true);
    setUndoChange(null); setMutationError("");
    if (apiClient && current.id) {
      try { const result = await undoChangeSet({ apiClient, id: current.id }); setLocalTasks((tasks) => result.tasks?.length ? tasks?.map((task) => result.tasks.find((restored) => restored.id === task.id) ?? task) : tasks?.map((task) => task.id === result.task?.id ? result.task : task)); setRescheduleApplied(false); const fresh = await getToday({ apiClient, date: rescheduleInput().date, timezone: rescheduleInput().timezone }); setRemote(fresh); setLocalTasks(fresh.tasks ?? []); }
      catch { setMutationError("Не вдалося скасувати зміни. Онови план."); }
      finally { setUndoing(false); }
    } else {
      setLocalTasks(current.previous);
      setUndoing(false);
    }
  };
  const rescheduleInput = () => ({ date: localDate(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", now: new Date().toISOString(), profile: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", workHours: { start: "09:00", end: "18:00" }, energyPeak: { start: "09:30", end: "12:30" }, focusBlockMinutes: 50, breakMinutes: 10, dailyLimitMinutes: 360 }, idempotencyKey: `reschedule-${localDate(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")}` });
  const previewReschedulePlan = async () => {
    if (!apiClient) { onNavigate("today-rescheduled"); return; }
    setRescheduleLoading(true); setRescheduleError("");
    try { setReschedulePreview(await previewReschedule({ apiClient, ...rescheduleInput() })); }
    catch { setRescheduleError("Не вдалося підготувати перепланування. Перевір з'єднання та спробуй ще раз."); }
    finally { setRescheduleLoading(false); }
  };
  const applyReschedulePlan = async () => {
    if (!apiClient || !reschedulePreview) return;
    setRescheduleLoading(true); setRescheduleError("");
    try { const result = await applyReschedule({ apiClient, ...rescheduleInput() }); const fresh = await getToday({ apiClient, date: rescheduleInput().date, timezone: rescheduleInput().timezone }); setRemote(fresh); setLocalTasks(fresh.tasks ?? []); setRescheduleApplied(true); setReschedulePreview(null); setUndoChange({ id: result.undoId ?? result.changeSet?.id, previous: visibleTasks, reschedule: true }); }
    catch { setRescheduleError("План не змінився. Одна із задач могла оновитися в іншій вкладці."); }
    finally { setRescheduleLoading(false); }
  };
  return (
    <AppFrame {...common}>
      <section className="today-header"><div><p>Привіт, {DEMO_USER.name}</p><h1>{screenId === "today-active" ? "Тримай один фокус" : "Спокійний план на день"}</h1><span>4 год 20 хв заплановано · 3 вільні слоти</span></div><ProgressRing value={screenId === "today-active" ? 38 : 25} /></section>
      {screenId === "today-overload" ? <InlineInsight tone="warning" title="День перевантажений">На сьогодні заплановано на 1 год 20 хв більше твого ліміту. Я можу перенести дві гнучкі задачі.</InlineInsight> : null}
      {rescheduleError ? <InlineInsight tone="warning" title="Перепланування не виконано">{rescheduleError}</InlineInsight> : null}
      {reschedulePreview ? <section className="reschedule-preview" aria-label="Попередній перегляд перепланування"><h2>Що зміниться</h2><p>{reschedulePreview.changes?.filter((change) => change.changed).length ?? 0} задач отримають новий час.</p><ul>{(reschedulePreview.changes ?? []).filter((change) => change.changed).slice(0, 3).map((change) => <li key={change.taskId}>{change.title}: {change.after?.plannedStart?.slice(11, 16) ?? "без слоту"}</li>)}</ul><Button onClick={applyReschedulePlan} disabled={rescheduleLoading}>{rescheduleLoading ? "Застосовую…" : "Застосувати перепланування"}</Button></section> : null}
      {remoteError ? <InlineInsight tone="warning" title="План тимчасово недоступний">{remoteError}</InlineInsight> : null}
      {screenId === "today-rescheduled" && showUndo ? <InlineInsight title="План змінився — я знайшов новий час.">Командний синк змістився. Лист Марії перенесено з 12:00 на 12:30.</InlineInsight> : null}
      {rescheduleApplied ? <InlineInsight title="План змінився — я знайшов новий час.">Гнучкі задачі отримали нові слоти. Якщо це не підходить, зміни можна скасувати.</InlineInsight> : null}
      {mutationError ? <InlineInsight tone="warning" title="План не змінився">{mutationError}</InlineInsight> : null}
      {undoing ? <InlineInsight title="Скасовую зміни…">Зачекай, поки Вектор поверне попередній стан плану.</InlineInsight> : null}
      <DayPlan active={screenId === "today-active"} onNavigate={onNavigate} tasks={visibleTasks} onComplete={complete} onSelect={setSheetTask} />
      {moveAnnouncement ? <p role="status" aria-live="polite" className="sr-only">{moveAnnouncement}</p> : null}
      {sheetTask ? <TaskTimeSheet task={sheetTask} saving={savingTime} onClose={() => setSheetTask(null)} onSave={saveTime} /> : null}
      <div className="break-card"><Coffee size={20} /><span><strong>10:30 · Перерва</strong><small>10 хв без задач</small></span><Clock size={17} /></div>
      {screenId === "today-overload" ? <Button variant="secondary" onClick={previewReschedulePlan} disabled={rescheduleLoading}>{rescheduleLoading ? "Готую новий план…" : "Переглянути новий план"}</Button> : null}
      {showUndo ? <UndoSnackbar message="Зміни застосовано — можна скасувати." onUndo={() => setShowUndo(false)} /> : null}
      {undoChange ? <UndoSnackbar message={undoChange.reschedule ? "Перепланування застосовано" : "Задачу виконано"} onUndo={undo} /> : null}
    </AppFrame>
  );
}
