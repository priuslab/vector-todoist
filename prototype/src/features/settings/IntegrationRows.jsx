import { CalendarBlank, CheckCircle, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react";

export function IntegrationRow({ type, status = "connected", onClick }) {
  const telegram = type === "telegram";
  const Icon = telegram ? PaperPlaneTilt : CalendarBlank;
  const label = telegram ? "Telegram" : "Google Calendar";
  const statusLabel = status === "connected" ? "Підключено" : status === "disabled" ? "Вимкнено" : status === "syncing" ? "Синхронізація…" : "Потребує уваги";
  return <button className="integration-row" onClick={onClick}><span className={`integration-icon integration-icon--${telegram ? "telegram" : "calendar"}`}><Icon size={22} weight="duotone" /></span><span><strong>{label}</strong><small>{statusLabel}</small></span>{status === "connected" ? <CheckCircle size={20} weight="fill" /> : status === "error" ? <WarningCircle size={20} weight="fill" /> : <span className="sync-dot" />}</button>;
}
