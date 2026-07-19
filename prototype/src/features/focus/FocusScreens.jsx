import { CheckCircle, Pause, Play, Stop } from "@phosphor-icons/react";
import { Button } from "../../components/Button";
import { DEMO_TASKS } from "../../data/demoData";

export function FocusScreens({ screenId = "focus-mode", onNavigate = () => {}, mode = "balanced" }) {
  if (screenId === "focus-complete") return <section className="focus-screen focus-screen--complete"><span className="focus-complete-icon"><CheckCircle size={42} weight="duotone" /></span><h1>Фокус-сесію завершено</h1><p>{DEMO_TASKS[0].title}</p><div className="focus-stat"><strong>47 хв</strong><span>фактичний час</span></div><h2>Як було?</h2><div className="reflection-pills"><button>Легше, ніж очікувала</button><button>Саме так</button><button>Потрібно більше часу</button></div><Button onClick={() => onNavigate("today-normal")}>Повернутися до дня</Button></section>;
  return <section className="focus-screen"><button className="focus-close" aria-label="Завершити"><Stop size={19} /></button><span className="focus-label">{mode === "goal_focus" ? "Goal Focus · без відволікань" : "Deep Work · без відволікань"}</span><div className="focus-timer">50:00</div><h1>{DEMO_TASKS[0].title}</h1><p>Один крок за раз. Решта задач почекає.</p><div className="focus-controls"><button aria-label="Пауза"><Pause size={24} weight="fill" /></button><button aria-label="Продовжити"><Play size={24} weight="fill" /></button></div><button className="finish-focus" onClick={() => onNavigate("focus-complete")}>Завершити раніше</button></section>;
}
