import { useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, CalendarBlank, CloudSlash, WarningCircle } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";
import { StateView } from "../../components/StateView";
import { DEMO_EVENTS, DEMO_TASKS } from "../../data/demoData";
import { CalendarTimeline } from "./CalendarTimeline";
import { EventSheet } from "./EventSheet";

const ukrainianWeekdays = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const pad = (value) => String(value).padStart(2, "0");
export function localDate(timezone, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}
function parseDate(value) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day, 12); }
function isoDate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function dateLabel(value) { const date = parseDate(value); return `${ukrainianWeekdays[date.getDay()]}, ${date.getDate()}`; }
function dateRangeLabel(value) { const date = parseDate(value); const end = new Date(date); end.setDate(end.getDate() + 6); return `${date.getDate()}–${end.getDate()} ${new Intl.DateTimeFormat("uk-UA", { month: "long" }).format(end)}`; }

function DayStrip({ selectedDate, onSelect }) {
  const selected = parseDate(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(selected); date.setDate(date.getDate() + index - 3); return isoDate(date); });
  return <div className="day-strip" aria-label="Вибір дати">{days.map((date) => <button type="button" key={date} className={date === selectedDate ? "is-active" : ""} aria-pressed={date === selectedDate} onClick={() => onSelect(date)}><span>{dateLabel(date).split(",")[0]}</span><strong>{parseDate(date).getDate()}</strong></button>)}</div>;
}

function WeekView({ tasks, busySlots }) {
  const busyMinutes = Math.round((busySlots?.length ?? 0) * 45);
  return <div className="week-view" aria-label="Тижневий огляд"><div className="week-head">{Array.from({ length: 5 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); const label = dateLabel(isoDate(date)); return <span key={label}>{label.split(",")[0]}<b>{date.getDate()}</b></span>; })}</div><div className="week-grid">{Array.from({ length: 5 }, (_, index) => <div key={index}><span className="week-busy" style={{ height: `${Math.min(88, 24 + (busyMinutes + (tasks?.length ?? 0) * 30 + index * 11) % 65)}%` }} /><small>{index === 0 ? `${tasks?.length ?? 0} задач` : index === 1 ? "Вільний ранок" : "Легший день"}</small></div>)}</div><div className="week-legend"><span><i />Зайнято</span><span><i />AI-задачі</span></div><InlineInsight>Найкращий вільний ранок для Deep Work — середа, 09:30–12:00.</InlineInsight></div>;
}

function normalizeTask(task) {
  const start = task.start ?? (task.plannedStart ? new Date(task.plannedStart).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) : undefined);
  const end = task.end ?? (task.plannedEnd ? new Date(task.plannedEnd).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) : undefined);
  return { ...task, start, end, duration: task.duration ?? task.estimatedMinutes, flexible: task.flexible !== false, locked: false };
}

export function CalendarScreens({ screenId = "calendar-day", onNavigate = () => {}, apiClient }) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [selectedDate, setSelectedDate] = useState(() => localDate(timezone));
  const [view, setView] = useState(screenId === "calendar-week" ? "week" : "day");
  const [selected, setSelected] = useState(screenId === "calendar-sheet" ? DEMO_EVENTS[0] : null);
  const [remote, setRemote] = useState(null);
  const [remoteState, setRemoteState] = useState(apiClient ? "loading" : "idle");
  const [mutationError, setMutationError] = useState("");
  const [undoAction, setUndoAction] = useState(null);
  const [pendingSync, setPendingSync] = useState(false);

  useEffect(() => {
    if (!apiClient) return undefined;
    let active = true;
    setRemoteState("loading");
    const load = async () => {
      try {
        const status = await apiClient.request("/api/v1/integrations/google-calendar/status").catch(() => null);
        if (status?.status === "connected") await apiClient.request("/api/v1/calendar/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: selectedDate, timezone }) }).catch(() => null);
        const [day, today] = await Promise.all([
          apiClient.request(`/api/v1/calendar/day?date=${encodeURIComponent(selectedDate)}`),
          apiClient.request(`/api/v1/today?date=${encodeURIComponent(selectedDate)}&timezone=${encodeURIComponent(timezone)}`).catch(() => null),
        ]);
        if (active) { setRemote({ ...(day ?? {}), ...(today ?? {}), slots: day?.slots ?? today?.slots ?? [], tasks: today?.tasks ?? day?.tasks ?? [] }); setRemoteState("ready"); }
      } catch { if (active) setRemoteState("error"); }
    };
    load();
    return () => { active = false; };
  }, [apiClient, selectedDate, timezone]);

  const tasks = useMemo(() => (remote?.tasks?.length ? remote.tasks.map(normalizeTask) : DEMO_TASKS), [remote]);
  const busy = useMemo(() => (remote?.slots?.length ? remote.slots.map((slot) => ({ ...slot, title: "Зайнято", locked: true, source: "google", start: new Date(slot.start).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }), end: new Date(slot.end).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) })) : DEMO_EVENTS), [remote]);
  const items = [...tasks, ...busy];
  const overload = screenId === "calendar-overload" || remote?.overload === true || (tasks.length > 6);

  async function saveTime(item, next) {
    if (!item || item.locked || item.flexible === false) return;
    const target = next ?? item;
    const before = { plannedStart: item.plannedStart ?? null, plannedEnd: item.plannedEnd ?? null, start: item.start, end: item.end };
    const changed = { ...item, plannedStart: target.plannedStart ?? `${selectedDate}T${target.start ?? item.start}:00`, plannedEnd: target.plannedEnd ?? `${selectedDate}T${target.end ?? item.end}:00`, start: target.start ?? item.start, end: target.end ?? item.end, syncStatus: "sync_pending" };
    setRemote((current) => current ? { ...current, tasks: (current.tasks ?? []).map((task) => task.id === item.id ? changed : task) } : current);
    setSelected(null); setPendingSync(true); setMutationError("");
    if (!apiClient) { setUndoAction({ item, before }); return; }
    try {
      const result = await apiClient.request(`/api/v1/tasks/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", "Idempotency-Key": `calendar-move:${item.id}:${changed.plannedStart}` }, body: JSON.stringify({ plannedStart: changed.plannedStart, plannedEnd: changed.plannedEnd, status: "scheduled" }) });
      const saved = result?.task ?? result;
      setRemote((current) => current ? { ...current, tasks: (current.tasks ?? []).map((task) => task.id === item.id ? { ...task, ...saved, syncStatus: saved?.syncStatus ?? "sync_pending" } : task) } : current);
      setUndoAction({ item, before });
    } catch { setMutationError("Не вдалося перенести задачу. Попередній час відновлено."); setPendingSync(false); setRemote((current) => current ? { ...current, tasks: (current.tasks ?? []).map((task) => task.id === item.id ? item : task) } : current); }
  }
  async function undoMove() {
    if (!undoAction) return;
    const { item, before } = undoAction;
    if (apiClient) await apiClient.request(`/api/v1/tasks/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", "Idempotency-Key": `calendar-undo:${item.id}:${Date.now()}` }, body: JSON.stringify({ plannedStart: before.plannedStart, plannedEnd: before.plannedEnd }) }).catch(() => setMutationError("Не вдалося скасувати переміщення."));
    setRemote((current) => current ? { ...current, tasks: (current.tasks ?? []).map((task) => task.id === item.id ? { ...task, ...before, syncStatus: "sync_pending" } : task) } : current);
    setUndoAction(null); setPendingSync(false);
  }

  if (apiClient && remoteState === "loading") return <AppFrame title="Календар" eyebrow={dateRangeLabel(selectedDate)} activeRoute="calendar-day" onNavigate={onNavigate} avatar><StateView state="loading" title="Синхронізую календар" message="Перевіряю задачі та зайняті слоти." /></AppFrame>;
  if (apiClient && remoteState === "error") return <AppFrame title="Календар" eyebrow={dateRangeLabel(selectedDate)} activeRoute="calendar-day" onNavigate={onNavigate} avatar><StateView state="error" title="Календар недоступний" message="Не вдалося завантажити календар. Спробуй ще раз." action={<Button onClick={() => window.location.reload()}>Оновити</Button>} /></AppFrame>;
  return <AppFrame title="Календар" eyebrow={view === "week" ? dateRangeLabel(selectedDate) : dateLabel(selectedDate)} activeRoute="calendar-day" onNavigate={onNavigate} avatar>
    <div className="calendar-toolbar"><div className="calendar-segmented" role="group" aria-label="Режим календаря"><button type="button" aria-pressed={view === "day"} className={view === "day" ? "is-active" : ""} onClick={() => setView("day")}>День</button><button type="button" aria-label="Тиждень" aria-pressed={view === "week"} className={view === "week" ? "is-active" : ""} onClick={() => setView("week")}>Тиждень</button></div><span className="calendar-timezone">{timezone}</span></div>
    <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
    {remote?.stale ? <div className="sync-banner"><CloudSlash size={18} /><span><strong>Календар може бути застарілим</strong><small>{remote.warning ?? "Показую останню успішну синхронізацію."}</small></span></div> : null}
    {pendingSync ? <div className="sync-banner sync-banner--pending" role="status"><CloudSlash size={18} /><span><strong>Зміни очікують синхронізації</strong><small>Календар оновиться, щойно з'єднання буде готове.</small></span></div> : null}
    {mutationError ? <div className="sync-banner sync-banner--error" role="alert"><WarningCircle size={18} /><span><strong>Не вдалося зберегти</strong><small>{mutationError}</small></span></div> : null}
    {overload ? <InlineInsight tone="warning" title="День перевантажений"><span>Частина задач не має реалістичного місця. Це не проблема — знайдемо спокійніший порядок.</span></InlineInsight> : null}
    {screenId === "calendar-conflict" ? <InlineInsight tone="warning" title="Знайдено конфлікт">Нова подія Google перекриває лист Марії. Задача потребує нового часу.</InlineInsight> : null}
    {screenId === "calendar-offline" ? <div className="sync-banner"><CloudSlash size={18} /><span><strong>Зміни очікують синхронізації</strong><small>Календар оновиться, коли повернеться інтернет.</small></span></div> : null}
    {view === "week" ? <WeekView tasks={tasks} busySlots={busy} /> : <CalendarTimeline items={items} onSelect={setSelected} onMove={saveTime} dragMode={screenId === "calendar-drag"} />}
    {overload ? <Button variant="secondary" icon={ArrowsClockwise} onClick={() => onNavigate("today-rescheduled")}>Знайти новий час</Button> : null}
    {screenId === "calendar-conflict" ? <Button variant="secondary" icon={ArrowsClockwise} onClick={() => onNavigate("today-rescheduled")}>Знайти новий час</Button> : null}
    {undoAction ? <div className="calendar-undo" role="status"><span>План змінився — я знайшов новий час.</span><Button variant="tertiary" onClick={undoMove}>Скасувати переміщення</Button></div> : null}
    {selected ? <EventSheet item={selected} onClose={() => setSelected(null)} onSave={saveTime} onRetry={apiClient ? (item) => apiClient.request(`/api/v1/tasks/${encodeURIComponent(item.taskId ?? item.id)}/calendar-sync`, { method: "POST", headers: { "Idempotency-Key": `calendar:retry:${item.taskId ?? item.id}` } }) : undefined} /> : null}
  </AppFrame>;
}
