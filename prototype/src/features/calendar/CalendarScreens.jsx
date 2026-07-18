import { useEffect, useState } from "react";
import { ArrowsClockwise, CalendarBlank, CloudSlash, WarningCircle } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";
import { StateView } from "../../components/StateView";
import { DEMO_EVENTS } from "../../data/demoData";
import { CalendarTimeline } from "./CalendarTimeline";
import { EventSheet } from "./EventSheet";

const days = [["Пн","14"],["Вт","15"],["Ср","16"],["Чт","17"],["Пт","18"],["Сб","19"],["Нд","20"]];
export function localDate(timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function DayStrip() {
  return <div className="day-strip">{days.map(([day,date]) => <button key={date} className={date === "18" ? "is-active" : ""}><span>{day}</span><strong>{date}</strong></button>)}</div>;
}

function WeekView() {
  return <div className="week-view"><div className="week-head">{days.slice(0,5).map(([day,date]) => <span key={date}>{day}<b>{date}</b></span>)}</div><div className="week-grid">{days.slice(0,5).map(([,date],index) => <div key={date}><span className="week-busy" style={{ height: `${[54,72,46,88,64][index]}%` }} /><small>{["3 год","4.5 год","2 год","5 год","3.5 год"][index]}</small></div>)}</div><div className="week-legend"><span><i />Зайнято</span><span><i />AI-задачі</span></div><InlineInsight>Найкращий вільний ранок для Deep Work — середа, 09:30–12:00.</InlineInsight></div>;
}

export function CalendarScreens({ screenId = "calendar-day", onNavigate = () => {}, apiClient }) {
  const [selected, setSelected] = useState(screenId === "calendar-sheet" ? DEMO_EVENTS[0] : null);
  const [remoteDay, setRemoteDay] = useState(null);
  const [remoteState, setRemoteState] = useState(apiClient ? "loading" : "idle");
  useEffect(() => {
    if (!apiClient) return;
    let active = true;
    setRemoteState("loading");
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const date = localDate(timezone);
    apiClient.request("/api/v1/integrations/google-calendar/status").catch(() => null)
      .then((status) => status?.status === "connected" ? apiClient.request("/api/v1/calendar/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, timezone }) }).catch(() => null) : null)
      .then(() => apiClient.request(`/api/v1/calendar/day?date=${encodeURIComponent(date)}`))
      .then((payload) => { if (active) { setRemoteDay(payload); setRemoteState("ready"); } })
      .catch(() => active && setRemoteState("error"));
    return () => { active = false; };
  }, [apiClient]);
  const remoteEvents = Array.isArray(remoteDay?.slots) ? remoteDay.slots.map((slot) => ({ ...slot, title: "Зайнято", locked: true, start: new Date(slot.start).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }), end: new Date(slot.end).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) })) : null;
  const calendarNotice = remoteState === "error" ? <StateView state="error" title="Календар недоступний" message="Не вдалося завантажити Google Calendar. Спробуй ще раз." action={<Button onClick={() => window.location.reload()}>Оновити</Button>} /> : remoteState === "loading" ? <StateView state="loading" title="Синхронізую календар" message="Перевіряю зайняті слоти." /> : remoteDay?.stale ? <div className="sync-banner"><CloudSlash size={18} /><span><strong>Календар може бути застарілим</strong><small>{remoteDay.warning ?? "Показую останню успішну синхронізацію."}</small></span></div> : null;
  return (
    <AppFrame title="Календар" eyebrow="18–24 липня" activeRoute="calendar-day" onNavigate={onNavigate} avatar>
      <DayStrip />
      {apiClient ? calendarNotice : null}
      {screenId === "calendar-conflict" ? <InlineInsight tone="warning" title="Знайдено конфлікт">Нова подія Google перекриває лист Марії. Задача потребує нового часу.</InlineInsight> : null}
      {screenId === "calendar-offline" ? <div className="sync-banner"><CloudSlash size={18} /><span><strong>Зміни очікують синхронізації</strong><small>Календар оновиться, коли повернеться інтернет.</small></span></div> : null}
      {screenId === "calendar-week" ? <WeekView /> : remoteEvents ? <CalendarTimeline dragMode={false} items={remoteEvents} onSelect={setSelected} /> : <CalendarTimeline dragMode={screenId === "calendar-drag"} onSelect={setSelected} />}
      {screenId === "calendar-drag" ? <div className="calendar-action"><Button onClick={() => onNavigate("calendar-day")}>Перемістити на 12:30</Button></div> : null}
      {screenId === "calendar-conflict" ? <Button variant="secondary" icon={ArrowsClockwise} onClick={() => onNavigate("today-rescheduled")}>Знайти новий час</Button> : null}
      {selected ? <EventSheet item={selected} onClose={() => setSelected(null)} /> : null}
    </AppFrame>
  );
}
