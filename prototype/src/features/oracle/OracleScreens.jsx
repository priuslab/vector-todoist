import { useState } from "react";
import { ArrowRight, Funnel, List, Sparkle } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";
import { StateView } from "../../components/StateView";
import { DEMO_GOAL } from "../../data/demoData";
import { OracleFilters } from "./OracleFilters";
import { OracleGraph } from "./OracleGraph";

const pathSteps = ["Головна мета","Пілотний епізод","Структура першого епізоду","Написати потенційному гостю"];

export function OracleScreens({ screenId = "oracle-balanced", onNavigate = () => {} }) {
  const [selected, setSelected] = useState(screenId === "oracle-goal-selected" ? { id:"goal-podcast", label:DEMO_GOAL.title, type:"goal" } : screenId === "oracle-idea-selected" ? { id:"idea-impostor", label:"Зробити епізод про синдром самозванця", type:"idea" } : null);
  const [filters, setFilters] = useState(screenId === "oracle-filters");
  const focusMode = screenId === "goal-focus-active";
  const showPath = screenId === "oracle-path" || focusMode;
  if (screenId === "oracle-empty") return <AppFrame title="Oracle" activeRoute="oracle-balanced" onNavigate={onNavigate}><StateView state="empty" title="Oracle чекає на мету" message="Додай одну головну мету, щоб побачити зв'язки між ідеями, проєктами та задачами." action={<Button onClick={() => onNavigate("goal-choice")}>Додати мету</Button>} /></AppFrame>;
  if (screenId === "oracle-path-list") return <AppFrame title="Шлях до мети" onBack={() => onNavigate("oracle-balanced")} activeRoute="oracle-balanced" onNavigate={onNavigate}><InlineInsight>Це найкоротший реалістичний маршрут з урахуванням твоєї енергії та календаря.</InlineInsight><div className="path-list">{pathSteps.map((step,index) => <div key={step}><span>{index+1}</span><strong>{step}</strong><small>{["Мета","Проєкт","Наступний крок","Після цього"][index]}</small></div>)}</div><Button onClick={() => onNavigate("today-normal")}>Почати з першого кроку</Button></AppFrame>;
  if (screenId === "goal-focus-confirm") return <AppFrame title="Goal Focus" onBack={() => onNavigate("oracle-balanced")} noNav><section className="focus-confirm"><span><Sparkle size={34} weight="duotone" /></span><h1>Залишити тільки те, що веде до мети?</h1><p>Вектор тимчасово прибере з активного плану 2 гнучкі нерелевантні задачі. Нічого не видаляється, зміни можна скасувати.</p><div className="focus-shifts"><span>Замовити корм коту → сьогодні 17:10</span><span>Ідея YouTube → приховати з активного плану</span></div><Button onClick={() => onNavigate("goal-focus-active")}>Увімкнути Goal Focus</Button><Button variant="tertiary" onClick={() => onNavigate("oracle-balanced")}>Залишити Balanced</Button></section></AppFrame>;

  return <AppFrame title="Oracle" eyebrow={focusMode ? "Goal Focus активний" : "Balanced"} activeRoute="oracle-balanced" onNavigate={onNavigate} avatar><div className="oracle-toolbar"><button onClick={() => setFilters(true)}><Funnel size={18} />Фільтри</button><button onClick={() => onNavigate("oracle-path-list")}><List size={18} />Списком</button></div>{screenId === "oracle-suggested-edge" ? <InlineInsight title="AI пропонує зв'язок">Ідея про синдром самозванця може стати другим епізодом сезону.</InlineInsight> : null}<OracleGraph selectedNodeId={selected?.id} focusMode={focusMode} showPath={showPath} onSelect={setSelected} /><div className="oracle-footer"><div><span>Відповідність меті</span><strong>{focusMode ? "94%" : "78%"}</strong></div><Button variant={showPath ? "secondary" : "primary"} onClick={() => onNavigate(showPath ? "goal-focus-confirm" : "oracle-path")}>{showPath ? "Увімкнути Goal Focus" : "Показати шлях"}</Button></div>{selected ? <BottomSheet title={selected.type === "goal" ? "Головна мета" : "Ідея"} onClose={() => setSelected(null)} actions={<Button onClick={() => onNavigate(selected.type === "goal" ? "oracle-path" : "idea-decomposition")}>{selected.type === "goal" ? "Показати шлях" : "Розбити на задачі"}</Button>}><h3 className="selected-node-title">{selected.label}</h3><p className="selected-node-copy">{selected.type === "goal" ? "42% прогресу · 1 активний проєкт · 3 наступні кроки" : "86% відповідності головній меті · пов'язано з пілотним епізодом"}</p></BottomSheet> : null}{filters ? <OracleFilters onClose={() => setFilters(false)} /> : null}</AppFrame>;
}
