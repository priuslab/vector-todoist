import { House, Microphone, Tray } from "@phosphor-icons/react";
import { isInternalRouteAllowed } from "../navigation/routeAccess";

const items = [
  ["today-normal", "Сьогодні", House],
  ["capture-chooser", "Brain Dump", Microphone],
  ["inbox-default", "Inbox", Tray],
];

export function BottomNav({ active, onNavigate, env = import.meta.env }) {
  return (
    <nav className="bottom-nav" aria-label="Головна навігація">
      {items.filter(([id]) => isInternalRouteAllowed({ route: id, env })).map(([id, label, Icon]) => {
        const isCapture = id === "capture-chooser";
        return (
        <button
          key={id}
          className={`bottom-nav__item ${id === active ? "is-active" : ""} ${isCapture ? "is-capture" : ""}`}
          onClick={() => onNavigate(id)}
          aria-label={label}
          aria-current={id === active ? "page" : undefined}
        >
          <Icon size={isCapture ? 25 : 22} weight={id === active ? "fill" : "regular"} aria-hidden />
          {isCapture ? null : <span>{label}</span>}
        </button>
      );})}
    </nav>
  );
}
