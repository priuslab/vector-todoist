import { useEffect, useRef, useState } from "react";
import { CheckCircle, CheckSquare, Flag, Folder, Lightbulb, Minus, Plus } from "@phosphor-icons/react";

const initialNodes = [
  { id: "goal-podcast", type: "goal", label: "Запустити сезон подкасту", x: 170, y: 118, Icon: Flag },
  { id: "project-pilot", type: "project", label: "Пілотний епізод", x: 72, y: 240, Icon: Folder },
  { id: "idea-impostor", type: "idea", label: "Зробити епізод про синдром самозванця", x: 252, y: 260, Icon: Lightbulb },
  { id: "task-structure", type: "task", label: "Структура першого епізоду", x: 120, y: 382, Icon: CheckSquare },
  { id: "task-guest", type: "task", label: "Лист потенційному гостю", x: 267, y: 410, Icon: CheckSquare },
  { id: "task-research", type: "completed", label: "Дослідити формат", x: 50, y: 465, Icon: CheckCircle },
  { id: "idea-youtube", type: "idea", label: "Почати YouTube-канал", x: 304, y: 96, Icon: Lightbulb },
];

const edges = [
  ["goal-podcast","project-pilot"],["goal-podcast","idea-impostor"],["project-pilot","task-structure"],["project-pilot","task-guest"],["project-pilot","task-research"],["idea-impostor","task-guest"],["idea-youtube","goal-podcast"],
];

const pathIds = new Set(["goal-podcast","project-pilot","idea-impostor","task-structure","task-guest"]);

export function OracleGraph({ selectedNodeId: controlledSelection, focusMode = false, showPath = false, onSelect }) {
  const [nodes, setNodes] = useState(initialNodes);
  const [selection, setSelection] = useState(controlledSelection ?? null);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const selectedNodeId = controlledSelection ?? selection;

  useEffect(() => {
    if (navigator.userAgent.includes("jsdom")) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    context.scale(ratio, ratio);
    context.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
    edges.forEach(([fromId,toId]) => {
      const from = nodes.find((node) => node.id === fromId);
      const to = nodes.find((node) => node.id === toId);
      const recommended = showPath && pathIds.has(fromId) && pathIds.has(toId);
      context.beginPath();
      context.moveTo(from.x * zoom, from.y * zoom);
      context.lineTo(to.x * zoom, to.y * zoom);
      context.strokeStyle = recommended ? "#246b5e" : "#cdd7d2";
      context.lineWidth = recommended ? 3 : 1.5;
      context.stroke();
    });
  }, [nodes, showPath, zoom]);

  const select = (node) => {
    setSelection(node.id);
    onSelect?.(node);
  };

  return (
    <div className={`oracle-graph ${focusMode ? "is-focus" : ""} ${showPath ? "is-path" : ""}`} data-testid="oracle-graph" data-selection={selectedNodeId ?? ""}>
      <canvas ref={canvasRef} aria-hidden />
      <div className="graph-stage" style={{ transform: `scale(${zoom})` }}>
        {nodes.map((node) => {
          const dimmed = (selectedNodeId && node.id !== selectedNodeId && !pathIds.has(node.id)) || (focusMode && node.id === "idea-youtube");
          return <button key={node.id} aria-label={node.label} className={`oracle-node oracle-node--${node.type} ${node.id === selectedNodeId ? "is-selected" : ""} ${dimmed ? "is-dimmed" : ""} ${showPath && pathIds.has(node.id) ? "is-path" : ""}`} style={{ left: node.x, top: node.y }} onClick={() => select(node)} onPointerDown={(event) => { dragRef.current = { id: node.id, x: event.clientX, y: event.clientY, originX: node.x, originY: node.y }; event.currentTarget.setPointerCapture?.(event.pointerId); }} onPointerMove={(event) => { const drag = dragRef.current; if (!drag || drag.id !== node.id) return; setNodes((items) => items.map((item) => item.id === node.id ? { ...item, x: drag.originX + event.clientX - drag.x, y: drag.originY + event.clientY - drag.y } : item)); }} onPointerUp={() => { dragRef.current = null; }}><node.Icon size={node.type === "goal" ? 25 : 19} weight="duotone" /><span>{node.label}</span></button>;
        })}
      </div>
      <div className="graph-zoom"><button aria-label="Зменшити" onClick={() => setZoom((value) => Math.max(.8, value - .1))}><Minus size={18} /></button><button aria-label="Збільшити" onClick={() => setZoom((value) => Math.min(1.2, value + .1))}><Plus size={18} /></button></div>
    </div>
  );
}
