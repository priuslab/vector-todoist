import { Plus, Target } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { LinearProgress } from "../../components/Progress";
import { DEMO_GOAL, DEMO_PROJECTS } from "../../data/demoData";

export function GoalScreens({ screenId = "goals-default", onNavigate = () => {} }) {
  if (screenId === "goal-add-second") return <AppFrame title="Нова мета" onBack={() => onNavigate("goals-default")} noNav><section className="goal-limit"><span><Target size={36} weight="duotone" /></span><h1>Одна мета вже веде твій план</h1><p>У безкоштовній версії доступна одна головна мета. Lifetime Pro відкриває необмежену кількість цілей без підписки.</p><div className="current-goal-mini"><strong>{DEMO_GOAL.title}</strong><small>Активна · 42% прогресу</small></div><Button onClick={() => onNavigate("paywall-lifetime")}>Переглянути Lifetime Pro</Button><Button variant="tertiary" onClick={() => onNavigate("goals-default")}>Залишити одну мету</Button></section></AppFrame>;
  return <AppFrame title="Мої цілі" eyebrow="1 активна" onBack={() => onNavigate("settings-home")} noNav><section className="goal-main"><span><Target size={30} weight="duotone" /></span><div><small>Головна мета</small><h1>{DEMO_GOAL.title}</h1></div></section><LinearProgress value={42} label="Загальний прогрес" /><div className="goal-metrics"><div><strong>1</strong><span>проєкт</span></div><div><strong>3</strong><span>наступні кроки</span></div><div><strong>78%</strong><span>alignment</span></div></div><section className="goal-projects"><h2>Пов'язані проєкти</h2><button><span><strong>{DEMO_PROJECTS[0].title}</strong><small>38% · 2 активні задачі</small></span></button></section><Button variant="secondary" icon={Plus} onClick={() => onNavigate("goal-add-second")}>Додати ще одну мету</Button></AppFrame>;
}
