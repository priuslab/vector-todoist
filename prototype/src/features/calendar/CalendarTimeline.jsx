import { LockSimple, Sparkle } from "@phosphor-icons/react";
import { DEMO_EVENTS, DEMO_TASKS } from "../../data/demoData";

const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const placements = {
  "task-structure": { top: 45, height: 64 },
  "event-sync": { top: 155, height: 50 },
  "task-guest": { top: 214, height: 36 },
  "task-cat-food": { top: 517, height: 30 },
};

function minutesFromStart(value) {
  if (!value) return 0;
  const match = String(value).match(/(?:T|\s)(\d{2}):(\d{2})/);
  if (!match) return 0;
  return (Number(match[1]) - 9) * 60 + Number(match[2]);
}

export function CalendarTimeline({ dragMode = false, onSelect, onMove, items: providedItems }) {
  const items = providedItems ?? [...DEMO_TASKS, ...DEMO_EVENTS];
  const move = (event, item) => {
    event.preventDefault();
    if (item.locked || item.flexible === false) return;
    onMove?.(item, { start: "12:30", end: "13:00" });
  };
  return (
    <div className={`calendar-timeline ${dragMode ? "is-dragging" : ""}`} aria-label="Розклад дня">
      <div className="calendar-hours">{hours.map((hour) => <span key={hour}>{hour}</span>)}</div>
      <div className="calendar-grid" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        const id = event.dataTransfer?.getData("text/plain");
        const item = items.find((candidate) => candidate.id === id);
        if (item) move(event, item);
      }}>
        {hours.map((hour) => <span className="calendar-line" key={hour} />)}
        {dragMode ? <span className="slot-highlight">12:30 · доступний слот</span> : null}
        {items.map((item) => {
          const placement = placements[item.id] ?? { top: Math.max(4, minutesFromStart(item.start ?? item.plannedStart) * 0.92), height: Math.max(30, Number(item.duration ?? item.estimatedMinutes ?? 30) * 0.92) };
          const locked = item.locked === true || item.source === "google";
          const flexible = !locked && item.flexible !== false;
          return <button
            key={item.id}
            type="button"
            aria-label={item.title}
            draggable={flexible}
            data-locked={locked ? "true" : "false"}
            data-flexible={flexible ? "true" : "false"}
            className={`calendar-block ${locked ? "calendar-block--locked" : "calendar-block--task"}`}
            style={{ top: placement.top, height: placement.height }}
            onDragStart={(event) => { if (!flexible) { event.preventDefault(); return; } event.dataTransfer?.setData("text/plain", item.id); }}
            onDrop={(event) => move(event, item)}
            onClick={() => onSelect?.(item)}
          ><strong>{item.start ?? (item.plannedStart ? new Date(item.plannedStart).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) : "09:00")} · {item.title}</strong><small>{locked ? <><LockSimple size={11} />{item.source === "google" ? "Google Calendar · зафіксовано" : "Зафіксований блок · не можна перенести"}</> : <><Sparkle size={11} />AI-задача · {item.duration ?? item.estimatedMinutes ?? 30} хв</>}</small></button>;
        })}
      </div>
    </div>
  );
}
