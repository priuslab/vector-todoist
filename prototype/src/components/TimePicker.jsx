import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { BottomSheet } from "./BottomSheet";

const OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 ? "30" : "00";
  return `${hour}:${minute}`;
});

export function TimePicker({ label, value, onChange, title = "Вибери час" }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="time-picker-control" aria-label={`${label} ${value}`} onClick={() => setOpen(true)}>
      <span className="time-picker-control__label">{label}</span>
      <strong>{value}</strong>
    </button>
    {open ? <BottomSheet title={title} onClose={() => setOpen(false)}><div className="time-picker-options" role="listbox" aria-label={title}>{OPTIONS.map((option) => <button type="button" role="option" aria-selected={option === value} className={option === value ? "is-selected" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}>{option}{option === value ? <Check size={20} weight="bold" aria-hidden /> : null}</button>)}</div></BottomSheet> : null}
  </>;
}
