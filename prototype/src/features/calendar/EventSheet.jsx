import { useEffect, useState } from "react";
import { CalendarBlank, Clock, LockSimple } from "@phosphor-icons/react";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `2026-07-19T${value}:00`);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventSheet({ item, selectedDate, onClose, onRetry, onSave }) {
  const locked = item?.locked === true || item?.source === "google";
  const syncStatus = item?.syncStatus ?? item?.calendarSyncStatus;
  const syncLabel = syncStatus === "synced" ? "Синхронізовано" : syncStatus === "attention" ? "Потрібне повторне підключення" : syncStatus === "sync_pending" || syncStatus === "pending" ? "Очікує синхронізації" : null;
  const fallbackStart = item?.start && String(item.start).includes(":") ? `${selectedDate ?? "2026-01-01"}T${item.start}:00` : undefined;
  const fallbackEnd = item?.end && String(item.end).includes(":") ? `${selectedDate ?? "2026-01-01"}T${item.end}:00` : undefined;
  const [start, setStart] = useState(toLocalInput(item?.plannedStart ?? fallbackStart));
  const [end, setEnd] = useState(toLocalInput(item?.plannedEnd ?? fallbackEnd));
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const save = () => onSave?.({ ...item, plannedStart: start ? new Date(start).toISOString() : null, plannedEnd: end ? new Date(end).toISOString() : null });
  const canRetry = syncStatus === "sync_pending" || syncStatus === "attention";
  return <BottomSheet title={locked ? "Подія Google" : "Запланована задача"} onClose={onClose} actions={<Button onClick={() => canRetry ? onRetry?.(item) : locked ? undefined : save()} variant={locked ? "secondary" : "primary"}>{locked ? "Відкрити в Google Calendar" : canRetry ? "Повторити синхронізацію" : "Зберегти час"}</Button>}>
    <div className="event-sheet-title"><span className={locked ? "is-locked" : ""}>{locked ? <LockSimple size={22} /> : <CalendarBlank size={22} />}</span><div><h3>{item?.title ?? "Командний синк"}</h3><p>{locked ? "Цей час зафіксований у Google Calendar" : "Зміни можна скасувати після синхронізації"}</p></div></div>
    <div className="event-details"><span><Clock size={18} />{item?.start ?? "11:00"}–{item?.end ?? "11:45"}</span><span><CalendarBlank size={18} />{selectedDate ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "long" }).format(new Date(`${selectedDate}T12:00:00`)) : item?.plannedStart ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "long" }).format(new Date(item.plannedStart)) : "Обрана дата"}</span>{syncLabel ? <span className="sync-status" aria-live="polite">{syncLabel}</span> : null}</div>
    {!locked ? <div className="event-time-form"><label htmlFor="event-date">Дата<input id="event-date" type="date" value={start.slice(0, 10)} onChange={(event) => setStart(`${event.target.value}T${start.slice(11, 16) || "09:00"}`)} /></label><label htmlFor="event-start">Початок<input id="event-start" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label htmlFor="event-end">Кінець<input id="event-end" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div> : null}
  </BottomSheet>;
}
