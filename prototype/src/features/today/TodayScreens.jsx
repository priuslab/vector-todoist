import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle, Clock, Coffee, Play } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";
import { ProgressRing } from "../../components/Progress";
import { StateView } from "../../components/StateView";
import { TaskCard } from "../../components/TaskCard";
import { UndoSnackbar } from "../../components/UndoSnackbar";
import { DEMO_EVENTS, DEMO_TASKS, DEMO_USER } from "../../data/demoData";
import { EveningReview } from "./EveningReview";
import { getToday } from "./todayApi";

function DayPlan({ active = false, onNavigate, completed = false, tasks = DEMO_TASKS }) {
  const current = tasks[0] ?? DEMO_TASKS[0];
  return (
    <div className="day-plan">
      <div className="now-card"><div><span>{active ? "Зараз · 24 хв залишилось" : "Наступна · 09:30"}</span><h2>{current.title}</h2><small>Deep Work · {current.duration ?? current.estimatedMinutes ?? 60} хв · 94% до мети</small></div><button aria-label="Почати фокус" onClick={() => onNavigate?.("focus-mode")}><Play size={20} weight="fill" /></button></div>
      <div className="timeline-list">
        <span className="timeline-label">Далі</span>
        <TaskCard task={{ ...DEMO_EVENTS[0], duration: 45, alignment: null }} state="locked" />
        {tasks.slice(1).map((task) => <TaskCard key={task.id} task={{ ...task, duration: task.duration ?? task.estimatedMinutes, start: task.start ?? task.plannedStart?.slice(11, 16), end: task.end ?? task.plannedEnd?.slice(11, 16) }} state={task.status === "completed" || completed ? "completed" : "scheduled"} />)}
      </div>
    </div>
  );
}

export function TodayScreens({ screenId = "today-normal", onNavigate = () => {}, apiClient }) {
  const [showUndo, setShowUndo] = useState(screenId === "today-rescheduled");
  const [remote, setRemote] = useState(null);
  const [remoteError, setRemoteError] = useState("");
  useEffect(() => { if (!apiClient || !["today-normal", "today-active", "today-overload"].includes(screenId)) return; let alive = true; getToday({ apiClient, date: new Date().toISOString().slice(0, 10), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }).then((value) => alive && setRemote(value)).catch(() => alive && setRemoteError("Не вдалося завантажити план. Спробуй оновити сторінку.")); return () => { alive = false; }; }, [apiClient, screenId]);
  const common = { title: "Сьогодні", eyebrow: "П'ятниця, 18 липня", activeRoute: "today-normal", onNavigate, avatar: true };

  if (apiClient && !remote && !remoteError && ["today-normal", "today-active", "today-overload"].includes(screenId)) return <AppFrame {...common}><StateView state="loading" title="Завантажую план" message="Вектор дістає твої задачі та вільні слоти." /></AppFrame>;
  if (apiClient && remoteError && !remote) return <AppFrame {...common}><StateView state="error" title="План тимчасово недоступний" message={remoteError} action={<Button onClick={() => window.location.reload()}>Оновити</Button>} /></AppFrame>;
  if (apiClient && remote && remote.tasks?.length === 0 && ["today-normal", "today-active", "today-overload"].includes(screenId)) return <AppFrame {...common}><StateView state="empty" title="На сьогодні задач ще немає" message="Зроби Brain Dump — Вектор допоможе знайти реалістичний наступний крок." action={<Button onClick={() => onNavigate("capture-chooser")}>Зробити Brain Dump</Button>} /></AppFrame>;

  if (screenId === "evening-review") return <AppFrame {...common}><EveningReview onFinish={() => onNavigate("today-complete")} /></AppFrame>;
  if (screenId === "today-empty") return <AppFrame {...common}><StateView state="empty" title="День ще порожній" message="Вислови все, що в голові, — Вектор складе перший реалістичний план." action={<Button onClick={() => onNavigate("capture-chooser")}>Зробити Brain Dump</Button>} /></AppFrame>;
  if (screenId === "today-complete") return <AppFrame {...common}><StateView state="success" title="На сьогодні достатньо" message="Усі заплановані задачі виконано. Решта може зачекати до завтра." action={<Button onClick={() => onNavigate("evening-review")}>Короткий підсумок</Button>} /></AppFrame>;

  return (
    <AppFrame {...common}>
      <section className="today-header"><div><p>Привіт, {DEMO_USER.name}</p><h1>{screenId === "today-active" ? "Тримай один фокус" : "Спокійний план на день"}</h1><span>4 год 20 хв заплановано · 3 вільні слоти</span></div><ProgressRing value={screenId === "today-active" ? 38 : 25} /></section>
      {screenId === "today-overload" ? <InlineInsight tone="warning" title="День перевантажений">На сьогодні заплановано на 1 год 20 хв більше твого ліміту. Я можу перенести дві гнучкі задачі.</InlineInsight> : null}
      {remoteError ? <InlineInsight tone="warning" title="План тимчасово недоступний">{remoteError}</InlineInsight> : null}
      {screenId === "today-rescheduled" && showUndo ? <InlineInsight title="План змінився — я знайшов новий час.">Командний синк змістився. Лист Марії перенесено з 12:00 на 12:30.</InlineInsight> : null}
      <DayPlan active={screenId === "today-active"} onNavigate={onNavigate} tasks={remote?.tasks?.length ? remote.tasks : DEMO_TASKS} />
      <div className="break-card"><Coffee size={20} /><span><strong>10:30 · Перерва</strong><small>10 хв без задач</small></span><Clock size={17} /></div>
      {screenId === "today-overload" ? <Button variant="secondary" onClick={() => onNavigate("today-rescheduled")}>Полегшити день</Button> : <Button variant="tertiary" icon={ArrowRight} onClick={() => onNavigate("calendar-day")}>Відкрити календар</Button>}
      {showUndo ? <UndoSnackbar message="План змінено" onUndo={() => setShowUndo(false)} /> : null}
    </AppFrame>
  );
}
