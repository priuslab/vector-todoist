import { CalendarBlank, Graph, House, Microphone, Tray } from "@phosphor-icons/react";

const items = [
  ["today-normal", "Сьогодні", House],
  ["inbox-default", "Inbox", Tray],
  ["capture-chooser", "Brain Dump", Microphone],
  ["calendar-day", "Календар", CalendarBlank],
  ["oracle-balanced", "Oracle", Graph],
];

export function BottomNav({ active, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Головна навігація">
      {items.map(([id, label, Icon], index) => (
        <button
          key={id}
          className={`bottom-nav__item ${id === active ? "is-active" : ""} ${index === 2 ? "is-capture" : ""}`}
          onClick={() => onNavigate(id)}
          aria-label={label}
          aria-current={id === active ? "page" : undefined}
        >
          <Icon size={index === 2 ? 25 : 22} weight={id === active ? "fill" : "regular"} aria-hidden />
          {index === 2 ? null : <span>{label}</span>}
        </button>
      ))}
    </nav>
  );
}
