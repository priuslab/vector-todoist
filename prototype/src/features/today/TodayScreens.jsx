import { useState } from "react";
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

function DayPlan({ active = false, onNavigate, completed = false }) {
  return (
    <div className="day-plan">
      <div className="now-card"><div><span>{active ? "Зараз · 24 хв залишилось" : "Наступна · 09:30"}</span><h2>{DEMO_TASKS[0].title}</h2><small>Deep Work · 60 хв · 94% до мети</small></div><button aria-label="Почати фокус" onClick={() => onNavigate?.("focus-mode")}><Play size={20} weight="fill" /></button></div>
      <div className="timeline-list">
        <span className="timeline-label">Далі</span>
        <TaskCard task={{ ...DEMO_EVENTS[0], duration: 45, alignment: null }} state="locked" />
        <TaskCard task={DEMO_TASKS[1]} />
        <TaskCard task={DEMO_TASKS[2]} state={completed ? "completed" : "scheduled"} />
      </div>
    </div>
  );
}

export function TodayScreens({ screenId = "today-normal", onNavigate = () => {} }) {
  const [showUndo, setShowUndo] = useState(screenId === "today-rescheduled");
  const common = { title: "Сьогодні", eyebrow: "П'ятниця, 18 липня", activeRoute: "today-normal", onNavigate, avatar: true };

  if (screenId === "evening-review") return <AppFrame {...common}><EveningReview onFinish={() => onNavigate("today-complete")} /></AppFrame>;
  if (screenId === "today-empty") return <AppFrame {...common}><StateView state="empty" title="День ще порожній" message="Вислови все, що в голові, — Вектор складе перший реалістичний план." action={<Button onClick={() => onNavigate("capture-chooser")}>Зробити Brain Dump</Button>} /></AppFrame>;
  if (screenId === "today-complete") return <AppFrame {...common}><StateView state="success" title="На сьогодні достатньо" message="Усі заплановані задачі виконано. Решта може зачекати до завтра." action={<Button onClick={() => onNavigate("evening-review")}>Короткий підсумок</Button>} /></AppFrame>;

  return (
    <AppFrame {...common}>
      <section className="today-header"><div><p>Привіт, {DEMO_USER.name}</p><h1>{screenId === "today-active" ? "Тримай один фокус" : "Спокійний план на день"}</h1><span>4 год 20 хв заплановано · 3 вільні слоти</span></div><ProgressRing value={screenId === "today-active" ? 38 : 25} /></section>
      {screenId === "today-overload" ? <InlineInsight tone="warning" title="День перевантажений">На сьогодні заплановано на 1 год 20 хв більше твого ліміту. Я можу перенести дві гнучкі задачі.</InlineInsight> : null}
      {screenId === "today-rescheduled" && showUndo ? <InlineInsight title="План змінився — я знайшов новий час.">Командний синк змістився. Лист Марії перенесено з 12:00 на 12:30.</InlineInsight> : null}
      <DayPlan active={screenId === "today-active"} onNavigate={onNavigate} />
      <div className="break-card"><Coffee size={20} /><span><strong>10:30 · Перерва</strong><small>10 хв без задач</small></span><Clock size={17} /></div>
      {screenId === "today-overload" ? <Button variant="secondary" onClick={() => onNavigate("today-rescheduled")}>Полегшити день</Button> : <Button variant="tertiary" icon={ArrowRight} onClick={() => onNavigate("calendar-day")}>Відкрити календар</Button>}
      {showUndo ? <UndoSnackbar message="План змінено" onUndo={() => setShowUndo(false)} /> : null}
    </AppFrame>
  );
}
