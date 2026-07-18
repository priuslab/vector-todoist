import { CalendarBlank, Check, Clock, LockSimple } from "@phosphor-icons/react";

export function TaskCard({ task, state = "scheduled", onClick, onComplete }) {
  const complete = state === "completed";
  return (
    <article className={`task-card task-card--${state}`} onClick={onClick}>
      <button
        className="task-card__check"
        aria-label={complete ? "Задачу виконано" : `Виконати: ${task.title}`}
        onClick={(event) => { event.stopPropagation(); onComplete?.(task.id); }}
      >
        {complete ? <Check size={16} weight="bold" aria-hidden /> : null}
      </button>
      <div className="task-card__body">
        <h3>{task.title}</h3>
        <div className="task-card__meta">
          <span><Clock size={14} aria-hidden />{task.start ?? `${task.duration} хв`}</span>
          {task.locked ? <span><LockSimple size={14} aria-hidden />Зафіксовано</span> : task.duration ? <span><CalendarBlank size={14} aria-hidden />{task.duration} хв</span> : null}
        </div>
      </div>
      {task.alignment ? <span className="alignment">{task.alignment}%</span> : null}
    </article>
  );
}
