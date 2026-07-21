import { useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { TimePicker } from "../../components/TimePicker";

function localDate(timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addMinutes(time, minutes) {
  const [hours, mins] = time.split(":").map(Number);
  const total = ((hours * 60 + mins + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function TaskTimeSheet({ task, onSave, onClose, saving = false }) {
  const [time, setTime] = useState(task.plannedStart?.slice(11, 16) ?? "09:00");
  const minutes = task.estimatedMinutes ?? 30;
  const endTime = addMinutes(time, minutes);

  const handleSave = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const start = new Date(`${localDate(timezone)}T${time}:00`);
    const plannedStart = start.toISOString();
    const plannedEnd = new Date(start.getTime() + minutes * 60000).toISOString();
    onSave({ plannedStart, plannedEnd });
  };

  return (
    <BottomSheet
      title="Змінити час"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Скасувати</Button>
          <Button loading={saving} onClick={handleSave}>Зберегти час</Button>
        </>
      }
    >
      <h3>{task.title}</h3>
      <TimePicker label="Початок" value={time} onChange={setTime} title="Обери початок" />
      <p className="task-time-sheet__end">Кінець: {endTime}</p>
    </BottomSheet>
  );
}
