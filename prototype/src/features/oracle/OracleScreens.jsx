import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Funnel, List, Sparkle } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";
import { StateView } from "../../components/StateView";
import { DEMO_GOAL } from "../../data/demoData";
import { OracleFilters } from "./OracleFilters";
import { OracleGraph, labels } from "./OracleGraph";

const fallbackGraph = { nodes: [{ id: "goal-podcast", type: "goal", title: "Запустити сезон подкасту" }, { id: "project-pilot", type: "project", title: "Пілотний епізод" }, { id: "idea-impostor", type: "idea", title: "Зробити епізод про синдром самозванця" }, { id: "task-structure", type: "task", title: "Структура першого епізоду" }, { id: "task-guest", type: "task", title: "Лист потенційному гостю" }, { id: "task-research", type: "completed", title: "Дослідити формат", completed: true }], edges: [{ id: "edge-0", fromId: "goal-podcast", toId: "project-pilot", status: "confirmed" }, { id: "edge-1", fromId: "project-pilot", toId: "task-structure", status: "confirmed" }, { id: "edge-2", fromId: "project-pilot", toId: "task-guest", status: "proposed" }] };
const pathSteps = ["Головна мета", "Пілотний епізод", "Структура першого епізоду", "Написати потенційному гостю"];

export function OracleScreens({ screenId = "oracle-balanced", onNavigate = () => {}, apiClient }) {
  const [graph, setGraph] = useState(apiClient ? null : fallbackGraph);
  const [loading, setLoading] = useState(Boolean(apiClient));
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(screenId === "oracle-goal-selected" ? { id: "goal-podcast", title: DEMO_GOAL.title, type: "goal" } : screenId === "oracle-idea-selected" ? { id: "idea-impostor", title: "Зробити епізод про синдром самозванця", type: "idea" } : null);
  const [path, setPath] = useState(null);
  const [filters, setFilters] = useState({ type: "all", pathOnly: false });
  const [showFilters, setShowFilters] = useState(screenId === "oracle-filters");
  const [showList, setShowList] = useState(false);
  const focusMode = screenId === "goal-focus-active";
  const showPath = screenId === "oracle-path" || focusMode || Boolean(path);
  useEffect(() => {
    if (!apiClient) return;
    let active = true;
    setLoading(true); setError(false);
    apiClient.request("/api/v1/oracle/graph").then((result) => { if (active) setGraph(result ?? { nodes: [], edges: [] }); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiClient]);
  const goalId = useMemo(() => graph?.nodes?.find((node) => node.type === "goal")?.id, [graph]);
  const selectNode = async (node) => {
    setSelected(node); setPath(null);
    if (!apiClient || !goalId || node.type === "goal") return;
    try { const result = await apiClient.request(`/api/v1/oracle/path?fromType=${encodeURIComponent(node.type)}&fromId=${encodeURIComponent(node.id)}&goalId=${encodeURIComponent(goalId)}`); setPath(result); } catch { setPath({ found: false, nodeIds: [], edgeIds: [], explanation: "Не вдалося завантажити шлях. Спробуй ще раз." }); }
  };
  if (screenId === "oracle-empty") return <AppFrame title="Oracle" activeRoute="oracle-balanced" onNavigate={onNavigate}><StateView state="empty" title="Oracle чекає на мету" message="Додай одну головну мету, щоб побачити зв’язки між ідеями, проєктами та задачами." action={<Button onClick={() => onNavigate("goal-choice")}>Додати мету</Button>} /></AppFrame>;
  if (screenId === "oracle-path-list") return <AppFrame title="Шлях до мети" onBack={() => onNavigate("oracle-balanced")} activeRoute="oracle-balanced" onNavigate={onNavigate}><InlineInsight>Це найкоротший реалістичний маршрут з урахуванням твоєї енергії та календаря.</InlineInsight><div className="path-list">{pathSteps.map((step, index) => <div key={step}><span>{index + 1}</span><strong>{step}</strong><small>{["Мета", "Проєкт", "Наступний крок", "Після цього"][index]}</small></div>)}</div><Button onClick={() => onNavigate("today-normal")}>Почати з першого кроку</Button></AppFrame>;
  if (screenId === "goal-focus-confirm") return <AppFrame title="Goal Focus" onBack={() => onNavigate("oracle-balanced")} noNav><section className="focus-confirm"><span><Sparkle size={34} weight="duotone" /></span><h1>Залишити тільки те, що веде до мети?</h1><p>Вектор тимчасово прибере з активного плану 2 гнучкі нерелевантні задачі. Нічого не видаляється, зміни можна скасувати.</p><Button onClick={() => onNavigate("goal-focus-active")}>Увімкнути Goal Focus</Button><Button variant="tertiary" onClick={() => onNavigate("oracle-balanced")}>Залишити Balanced</Button></section></AppFrame>;
  const visibleNodes = graph?.nodes?.filter((node) => filters.type === "all" || node.type === filters.type) ?? [];
  const pathNodeIds = path?.found ? path.nodeIds : (showPath ? ["goal-podcast", "project-pilot", "task-structure", "task-guest"] : []);
  return <AppFrame title="Oracle" eyebrow={focusMode ? "Goal Focus активний" : "Balanced"} activeRoute="oracle-balanced" onNavigate={onNavigate} avatar><div className="oracle-toolbar"><button type="button" onClick={() => setShowFilters(true)}><Funnel size={18} />Фільтри</button><button type="button" aria-pressed={showList} onClick={() => setShowList((value) => !value)}><List size={18} />{showList ? "Карта" : "Списком"}</button></div>{screenId === "oracle-suggested-edge" ? <InlineInsight title="AI пропонує зв’язок">Ідея про синдром самозванця може стати другим епізодом сезону.</InlineInsight> : null}<OracleGraph graph={graph} loading={loading} error={error} selectedNodeId={selected?.id} pathNodeIds={pathNodeIds} pathEdgeIds={path?.edgeIds ?? []} filters={filters} focusMode={focusMode} onSelect={selectNode} /><div className="oracle-accessible-list" hidden={!showList}><h2>Вузли карти</h2>{visibleNodes.length ? <ul aria-label="Список вузлів Oracle">{visibleNodes.map((node) => <li key={`${node.type}-${node.id}`}><button type="button" onClick={() => selectNode(node)} aria-pressed={selected?.id === node.id}><strong>{node.title ?? node.label}</strong><span>{labels[node.type] ?? "Вузол"}{node.completed ? " · виконано" : ""}</span></button></li>)}</ul> : <p>Немає вузлів для цього фільтра.</p>}</div><div className="oracle-footer"><div><span>Відповідність меті</span><strong>{focusMode ? "94%" : path?.score ? `${Math.round(path.score * 100)}%` : "78%"}</strong></div><Button variant={showPath ? "secondary" : "primary"} onClick={() => onNavigate(showPath ? "goal-focus-confirm" : "oracle-path")}>{showPath ? "Увімкнути Goal Focus" : "Показати шлях"}</Button></div>{selected ? <BottomSheet title={labels[selected.type] ?? "Вузол"} onClose={() => { setSelected(null); setPath(null); }} actions={<Button onClick={() => onNavigate(selected.type === "goal" ? "oracle-path-list" : "idea-decomposition")}>{selected.type === "goal" ? "Показати шлях" : "Розбити на задачі"}</Button>}><h3 className="selected-node-title">{selected.title ?? selected.label}</h3><p className="selected-node-copy">{path?.explanation ?? (selected.type === "goal" ? "42% прогресу · 1 активний проєкт · 3 наступні кроки" : "Обираю пов’язані вузли та шукаю реалістичний шлях до мети.")}</p></BottomSheet> : null}{showFilters ? <OracleFilters value={filters} onApply={setFilters} onClose={() => setShowFilters(false)} /> : null}</AppFrame>;
}
