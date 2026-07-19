import { useEffect, useState } from "react";
import { Bell, Brain, Clock, Crown, Lightning, Moon, SlidersHorizontal, Sparkle, Target } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";
import { StateView } from "../../components/StateView";
import { UndoSnackbar } from "../../components/UndoSnackbar";
import { DEMO_USER } from "../../data/demoData";
import { IntegrationRow } from "./IntegrationRows";

const menu = [
  ["settings-work", Clock, "Робочий ритм", "Пн–Пт · 09:00–18:00"],
  ["settings-energy", Lightning, "Енергія та фокус", "Пік 09:30–12:30 · блок 50 хв"],
  ["settings-notifications", Bell, "Сповіщення", "Telegram · тихі години 21:00–08:00"],
  ["settings-adaptation", Brain, "AI-адаптація", "1 нове спостереження"],
  ["goals-default", Target, "Мої цілі", "1 активна мета"],
  ["settings-pro", Crown, "Lifetime Pro", "Без підписки"],
];

function SettingsForm({ screenId }) {
  if (screenId === "settings-work") return <div className="form-stack"><label>Робочі дні<input value="Понеділок–п'ятниця" readOnly /></label><div className="form-grid"><label>Початок<input value="09:00" readOnly /></label><label>Завершення<input value="18:00" readOnly /></label></div><label className="switch-row"><span>Планувати у вихідні</span><input type="checkbox" /></label></div>;
  if (screenId === "settings-energy") return <div className="form-stack"><label>Пік енергії<input value="09:30–12:30" readOnly /></label><div className="form-grid"><label>Фокус-блок<input value="50 хв" readOnly /></label><label>Перерва<input value="10 хв" readOnly /></label></div><label>Денний ліміт<input value="6 год" readOnly /></label><InlineInsight>Вектор помітив, що 50-хвилинні блоки завершуються найчастіше.</InlineInsight></div>;
  return <div className="form-stack"><label className="switch-row"><span><Bell size={19} />Ранковий план</span><input type="checkbox" defaultChecked /></label><label className="switch-row"><span><Bell size={19} />Нагадування про задачі</span><input type="checkbox" defaultChecked /></label><label className="switch-row"><span><Moon size={19} />Вечірній підсумок</span><input type="checkbox" defaultChecked /></label><label>Тихі години<input value="21:00–08:00" readOnly /></label><label>Частота<input value="Лише важливі" readOnly /></label></div>;
}

export function SettingsScreens({ screenId = "settings-home", onNavigate = () => {}, apiClient }) {
  const [saved, setSaved] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState(null);
  useEffect(() => { if (screenId !== "settings-telegram" || !apiClient) return; let active = true; apiClient.request("/api/v1/integrations/telegram/status").then((result) => active && setTelegramStatus(result)).catch(() => active && setTelegramStatus({ status: "error" })); return () => { active = false; }; }, [screenId, apiClient]);
  if (["settings-work","settings-energy","settings-notifications"].includes(screenId)) return <AppFrame title={screenId === "settings-work" ? "Робочий ритм" : screenId === "settings-energy" ? "Енергія та фокус" : "Сповіщення"} onBack={() => onNavigate("settings-home")} noNav footer={<Button onClick={() => setSaved(true)}>Зберегти</Button>}><SettingsForm screenId={screenId} />{saved ? <UndoSnackbar message="Налаштування збережено" onUndo={() => setSaved(false)} /> : null}</AppFrame>;
  if (screenId === "settings-telegram") { const connected = apiClient ? telegramStatus?.status === "connected" : true; const disconnect = async () => { if (apiClient) await apiClient.request("/api/v1/integrations/telegram", { method: "DELETE" }); setTelegramStatus({ status: "disconnected" }); }; return <AppFrame title="Telegram" onBack={() => onNavigate("settings-home")} noNav footer={connected ? <Button variant="danger" onClick={disconnect}>Відключити Telegram</Button> : <Button onClick={() => onNavigate("telegram-connect")}>Підключити Telegram</Button>}><IntegrationRow type="telegram" status={connected ? "connected" : telegramStatus?.status === "error" ? "error" : "disabled"} /><section className="integration-detail"><h1>{connected ? "Telegram підключено" : "Telegram ще не підключено"}</h1><p>Голосові думки, ранковий план, нагадування та результати перепланування приходять у бот.</p>{connected ? <><label className="switch-row"><span>Приймати голосові</span><input type="checkbox" defaultChecked /></label><label className="switch-row"><span>Кнопка Undo у повідомленнях</span><input type="checkbox" defaultChecked /></label></> : <p>Створи одноразове посилання, щоб безпечно прив'язати чат.</p>}</section></AppFrame>; }
  if (screenId === "settings-calendar") return <AppFrame title="Google Calendar" onBack={() => onNavigate("settings-home")} noNav footer={<Button variant="secondary">Синхронізувати зараз</Button>}><IntegrationRow type="calendar" status="syncing" /><section className="integration-detail"><h1>Двостороння синхронізація</h1><p>Події Google блокують час. Задачі Вектора з'являються як окремі календарні блоки.</p><div className="sync-stats"><span><strong>18</strong>подій прочитано</span><span><strong>4</strong>AI-блоки створено</span></div></section></AppFrame>;
  if (screenId === "settings-adaptation") {
    const adaptationFooter = <><Button onClick={() => setSaved(true)}>Прийняти зміну</Button><Button variant="secondary">Залишити 50 хв</Button></>;
    return <AppFrame title="AI-адаптація" onBack={() => onNavigate("settings-home")} noNav footer={adaptationFooter} footerRows={2} contentAlign="center"><section className="adaptation"><span><Sparkle size={32} weight="duotone" /></span><h1>Вектор помітив закономірність</h1><p>Складні задачі у тебе займають у середньому на 12 хв довше, ніж перша оцінка.</p><div className="adaptation-change"><span><small>Було</small><strong>Фокус-блок · 50 хв</strong></span><span><small>Рекомендація</small><strong>Фокус-блок · 60 хв</strong></span></div><InlineInsight>Це рекомендація. Важливі налаштування ніколи не змінюються приховано.</InlineInsight></section>{saved ? <UndoSnackbar message="Налаштування оновлено" onUndo={() => setSaved(false)} /> : null}</AppFrame>;
  }
  if (screenId === "settings-pro") return <AppFrame title="Lifetime Pro" onBack={() => onNavigate("settings-home")} noNav footer={<Button variant="secondary">Відновити покупку</Button>} contentAlign="center"><StateView state="success" title="Lifetime Pro активний" message="Необмежені цілі та всі майбутні Pro-функції доступні назавжди." /></AppFrame>;
  return <AppFrame title="Налаштування" onBack={() => onNavigate("today-normal")} noNav><section className="profile-card"><span>{DEMO_USER.initials}</span><div><h1>{DEMO_USER.name}</h1><p>olena@example.com</p></div></section><div className="settings-menu">{menu.map(([id,Icon,title,meta]) => <button key={id} onClick={() => onNavigate(id)}><span><Icon size={21} /></span><div><strong>{title}</strong><small>{meta}</small></div></button>)}</div><h2 className="settings-section-title">Інтеграції</h2><IntegrationRow type="telegram" onClick={() => onNavigate("settings-telegram")} /><IntegrationRow type="calendar" onClick={() => onNavigate("settings-calendar")} /></AppFrame>;
}
