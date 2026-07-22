import { LockSimple, Sparkle } from "@phosphor-icons/react";
import { DEMO_EVENTS, DEMO_TASKS } from "../../data/demoData";

const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const placements = {
  "task-structure": { top: 45, height: 64 },
  "event-sync": { top: 155, height: 50 },
  "task-guest": { top: 214, height: 36 },
  "task-cat-food": { top: 517, height: 30 },
};

export function CalendarTimeline({ dragMode = false, onSelect, tasks = DEMO_TASKS }) {
  const items = [...tasks, ...DEMO_EVENTS];
  return (
    <div className={`calendar-timeline ${dragMode ? "is-dragging" : ""}`}>
      <div className="calendar-hours">{hours.map((hour) => <span key={hour}>{hour}</span>)}</div>
      <div className="calendar-grid">
        {hours.map((hour) => <span className="calendar-line" key={hour} />)}
        {dragMode ? <span className="slot-highlight">12:30 · доступний слот</span> : null}
        {items.map((item) => {
          const placement = placements[item.id] ?? { top: Math.max(20, ((Number(item.start?.slice(0, 2)) - 9) * 74) + (Number(item.start?.slice(3, 5)) / 60 * 74)), height: Math.max(28, (item.duration ?? 30) * 1.05) };
          return <button key={item.id} aria-label={item.title} data-locked={item.locked ? "true" : "false"} className={`calendar-block ${item.locked ? "calendar-block--locked" : "calendar-block--task"}`} style={{ top: placement.top, height: placement.height }} onClick={() => onSelect?.(item)}><strong>{item.start} · {item.title}</strong><small>{item.locked ? <><LockSimple size={11} />Google Calendar</> : <><Sparkle size={11} />AI-задача · {item.duration} хв</>}</small></button>;
        })}
      </div>
    </div>
  );
}
