import { useState } from "react";
import { ArrowsClockwise, CalendarBlank, CloudSlash, WarningCircle } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";
import { DEMO_EVENTS } from "../../data/demoData";
import { CalendarTimeline } from "./CalendarTimeline";
import { EventSheet } from "./EventSheet";

const days = [["Пн","14"],["Вт","15"],["Ср","16"],["Чт","17"],["Пт","18"],["Сб","19"],["Нд","20"]];

function DayStrip() {
  return <div className="day-strip">{days.map(([day,date]) => <button key={date} className={date === "18" ? "is-active" : ""}><span>{day}</span><strong>{date}</strong></button>)}</div>;
}

function WeekView() {
  return <div className="week-view"><div className="week-head">{days.slice(0,5).map(([day,date]) => <span key={date}>{day}<b>{date}</b></span>)}</div><div className="week-grid">{days.slice(0,5).map(([,date],index) => <div key={date}><span className="week-busy" style={{ height: `${[54,72,46,88,64][index]}%` }} /><small>{["3 год","4.5 год","2 год","5 год","3.5 год"][index]}</small></div>)}</div><div className="week-legend"><span><i />Зайнято</span><span><i />AI-задачі</span></div><InlineInsight>Найкращий вільний ранок для Deep Work — середа, 09:30–12:00.</InlineInsight></div>;
}

export function CalendarScreens({ screenId = "calendar-day", onNavigate = () => {} }) {
  const [selected, setSelected] = useState(screenId === "calendar-sheet" ? DEMO_EVENTS[0] : null);
  return (
    <AppFrame title="Календар" eyebrow="18–24 липня" activeRoute="calendar-day" onNavigate={onNavigate} avatar>
      <DayStrip />
      {screenId === "calendar-conflict" ? <InlineInsight tone="warning" title="Знайдено конфлікт">Нова подія Google перекриває лист Марії. Задача потребує нового часу.</InlineInsight> : null}
      {screenId === "calendar-offline" ? <div className="sync-banner"><CloudSlash size={18} /><span><strong>Зміни очікують синхронізації</strong><small>Календар оновиться, коли повернеться інтернет.</small></span></div> : null}
      {screenId === "calendar-week" ? <WeekView /> : <CalendarTimeline dragMode={screenId === "calendar-drag"} onSelect={setSelected} />}
      {screenId === "calendar-drag" ? <div className="calendar-action"><Button onClick={() => onNavigate("calendar-day")}>Перемістити на 12:30</Button></div> : null}
      {screenId === "calendar-conflict" ? <Button variant="secondary" icon={ArrowsClockwise} onClick={() => onNavigate("today-rescheduled")}>Знайти новий час</Button> : null}
      {selected ? <EventSheet item={selected} onClose={() => setSelected(null)} /> : null}
    </AppFrame>
  );
}
