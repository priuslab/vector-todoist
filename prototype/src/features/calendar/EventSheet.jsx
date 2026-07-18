import { CalendarBlank, Clock, LockSimple } from "@phosphor-icons/react";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";

export function EventSheet({ item, onClose, onRetry }) {
  const locked = item?.locked;
  const syncStatus = item?.syncStatus ?? item?.calendarSyncStatus;
  const syncLabel = syncStatus === "synced" ? "Синхронізовано" : syncStatus === "attention" ? "Потрібне повторне підключення" : syncStatus === "sync_pending" || syncStatus === "pending" ? "Очікує синхронізації" : null;
  return <BottomSheet title={locked ? "Подія Google" : "Запланована задача"} onClose={onClose} actions={<Button onClick={() => syncStatus === "sync_pending" || syncStatus === "attention" ? onRetry?.(item) : undefined} variant={locked ? "secondary" : "primary"}>{locked ? "Відкрити в Google Calendar" : syncStatus === "sync_pending" || syncStatus === "attention" ? "Повторити синхронізацію" : "Редагувати задачу"}</Button>}><div className="event-sheet-title"><span className={locked ? "is-locked" : ""}>{locked ? <LockSimple size={22} /> : <CalendarBlank size={22} />}</span><div><h3>{item?.title ?? "Командний синк"}</h3><p>{locked ? "Цей час зафіксований у Google Calendar" : "Вектор може перенести цю задачу за потреби"}</p></div></div><div className="event-details"><span><Clock size={18} />{item?.start ?? "11:00"}–{item?.end ?? "11:45"}</span><span><CalendarBlank size={18} />П'ятниця, 18 липня</span>{syncLabel ? <span className="sync-status" aria-live="polite">{syncLabel}</span> : null}</div></BottomSheet>;
}
