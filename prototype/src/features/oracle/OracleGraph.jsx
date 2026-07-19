import { useMemo, useState } from "react";
import { CheckCircle, CheckSquare, Flag, Folder, Lightbulb, Minus, Plus, ArrowsClockwise } from "@phosphor-icons/react";
import { useGraphViewport } from "./useGraphViewport";

const fallbackNodes = [
  { id: "goal-podcast", type: "goal", title: "Запустити сезон подкасту", x: 170, y: 118 },
  { id: "project-pilot", type: "project", title: "Пілотний епізод", x: 72, y: 240 },
  { id: "idea-impostor", type: "idea", title: "Зробити епізод про синдром самозванця", x: 252, y: 260 },
  { id: "task-structure", type: "task", title: "Структура першого епізоду", x: 120, y: 382 },
  { id: "task-guest", type: "task", title: "Лист потенційному гостю", x: 267, y: 410 },
  { id: "task-research", type: "completed", title: "Дослідити формат", x: 50, y: 465, completed: true },
  { id: "idea-youtube", type: "idea", title: "Почати YouTube-канал", x: 304, y: 96 },
];
const fallbackEdges = [
  ["goal-podcast", "project-pilot"], ["goal-podcast", "idea-impostor"], ["project-pilot", "task-structure"],
  ["project-pilot", "task-guest"], ["project-pilot", "task-research"], ["idea-impostor", "task-guest"], ["idea-youtube", "goal-podcast"],
].map(([fromId, toId], index) => ({ id: `edge-${index}`, fromId, toId, actor: "user", status: "confirmed" }));
const icons = { goal: Flag, project: Folder, idea: Lightbulb, task: CheckSquare, completed: CheckCircle };
const labels = { goal: "Мета", project: "Проєкт", idea: "Ідея", task: "Задача", completed: "Виконано" };

function positionNodes(nodes) {
  const slots = [{ x: 170, y: 108 }, { x: 72, y: 230 }, { x: 262, y: 236 }, { x: 116, y: 370 }, { x: 270, y: 400 }, { x: 52, y: 464 }, { x: 304, y: 92 }];
  return nodes.map((node, index) => ({ ...node, label: node.title ?? node.label ?? node.id, x: Number.isFinite(node.x) ? node.x : slots[index % slots.length].x, y: Number.isFinite(node.y) ? node.y : slots[index % slots.length].y }));
}

export function OracleGraph({ graph, selectedNodeId, pathNodeIds = [], pathEdgeIds = [], filters = {}, focusMode = false, onSelect, loading = false, error = false, onReset }) {
  const { viewport, reset, zoomBy, beginPan, pan, endPan } = useGraphViewport({ storageKey: "vector-oracle-viewport-v1" });
  const [draggedNode, setDraggedNode] = useState(null);
  const nodes = useMemo(() => positionNodes(graph?.nodes?.length ? graph.nodes : fallbackNodes), [graph]);
  const edges = useMemo(() => graph?.edges?.length ? graph.edges : fallbackEdges, [graph]);
  const visibleNodes = useMemo(() => nodes.filter((node) => !filters.type || filters.type === "all" || node.type === filters.type), [filters.type, nodes]);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const selected = selectedNodeId ? nodeById.get(selectedNodeId) : null;
  const path = new Set(pathNodeIds);
  const hasSelection = Boolean(selectedNodeId);
  const isDimmed = (node) => (hasSelection && node.id !== selectedNodeId && path.size > 0 && !path.has(node.id)) || (hasSelection && path.size === 0 && node.id !== selectedNodeId) || (focusMode && node.type === "idea" && node.id.includes("youtube"));
  const resetViewport = () => { reset(); onReset?.(); };
  if (loading) return <div className="oracle-graph oracle-graph--state" data-testid="oracle-graph-loading" role="status">Завантажую карту зв’язків…</div>;
  if (error) return <div className="oracle-graph oracle-graph--state" data-testid="oracle-graph-error" role="alert">Не вдалося завантажити Oracle. Спробуй оновити сторінку.</div>;
  if (!nodes.length) return <div className="oracle-graph oracle-graph--state" data-testid="oracle-graph-empty">Тут поки немає зв’язків.</div>;
  return <div className="oracle-graph" data-testid="oracle-graph" data-selection={selectedNodeId ?? ""} data-reduced-motion="media" onPointerDown={beginPan} onPointerMove={pan} onPointerUp={endPan} onPointerCancel={endPan}>
    <svg className="oracle-edges" viewBox="0 0 390 520" aria-hidden="true" focusable="false"><g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
      {edges.map((edge) => { const from = nodeById.get(edge.fromId); const to = nodeById.get(edge.toId); if (!from || !to) return null; const active = pathEdgeIds.includes?.(edge.id) || (path.size > 1 && path.has(from.id) && path.has(to.id)); const dimmed = hasSelection && !active && (!path.has(from.id) || !path.has(to.id)); return <line key={edge.id ?? `${edge.fromId}-${edge.toId}`} className={`oracle-edge ${active ? "is-active" : ""} ${edge.status === "proposed" ? "is-proposed" : ""} ${dimmed ? "is-dimmed" : ""}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />; })}
    </g></svg>
    <div className="graph-stage" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
      {visibleNodes.map((node) => { const Icon = icons[node.type] ?? CheckSquare; const dimmed = isDimmed(node); const active = path.has(node.id); return <button key={`${node.type}-${node.id}`} type="button" aria-label={node.label} aria-pressed={node.id === selectedNodeId} className={`oracle-node oracle-node--${node.type} ${node.id === selectedNodeId ? "is-selected" : ""} ${dimmed ? "is-dimmed" : ""} ${active ? "is-path" : ""}`} style={{ left: node.x, top: node.y }} onPointerDown={(event) => { event.stopPropagation(); setDraggedNode({ id: node.id, clientX: event.clientX, clientY: event.clientY }); }} onPointerMove={(event) => { if (draggedNode?.id === node.id) event.stopPropagation(); }} onPointerUp={(event) => { event.stopPropagation(); setDraggedNode(null); onSelect?.(node); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect?.(node); }}><Icon size={node.type === "goal" ? 25 : 19} weight="duotone" aria-hidden /><span>{node.label}</span><small>{labels[node.type] ?? "Вузол"}{node.status === "proposed" ? " · пропозиція AI" : ""}</small></button>; })}
    </div>
    <div className="graph-controls" aria-label="Керування картою"><button type="button" aria-label="Зменшити масштаб" onClick={() => zoomBy(-.1)}><Minus size={18} aria-hidden /></button><span aria-live="polite">{Math.round(viewport.scale * 100)}%</span><button type="button" aria-label="Збільшити масштаб" onClick={() => zoomBy(.1)}><Plus size={18} aria-hidden /></button><button type="button" aria-label="Скинути карту" onClick={resetViewport}><ArrowsClockwise size={18} aria-hidden /></button></div>
    {selected ? <p className="oracle-selection-hint" role="status">Обрано: {selected.label}. Показано пов’язані вузли та шлях.</p> : null}
  </div>;
}

export { labels };
