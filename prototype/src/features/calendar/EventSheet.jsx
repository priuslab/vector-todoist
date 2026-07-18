import { CalendarBlank, Clock, LockSimple } from "@phosphor-icons/react";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";

export function EventSheet({ item, onClose }) {
  const locked = item?.locked;
  return <BottomSheet title={locked ? "Подія Google" : "Запланована задача"} onClose={onClose} actions={<Button variant={locked ? "secondary" : "primary"}>{locked ? "Відкрити в Google Calendar" : "Редагувати задачу"}</Button>}><div className="event-sheet-title"><span className={locked ? "is-locked" : ""}>{locked ? <LockSimple size={22} /> : <CalendarBlank size={22} />}</span><div><h3>{item?.title ?? "Командний синк"}</h3><p>{locked ? "Цей час зафіксований у Google Calendar" : "Вектор може перенести цю задачу за потреби"}</p></div></div><div className="event-details"><span><Clock size={18} />{item?.start ?? "11:00"}–{item?.end ?? "11:45"}</span><span><CalendarBlank size={18} />П'ятниця, 18 липня</span></div></BottomSheet>;
}
