import { useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";

const types = [["all", "Усі"], ["goal", "Мети"], ["project", "Проєкти"], ["idea", "Ідеї"], ["task", "Задачі"], ["completed", "Виконано"]];

export function OracleFilters({ onClose, value = {}, onApply }) {
  const [type, setType] = useState(value.type ?? "all");
  const [pathOnly, setPathOnly] = useState(Boolean(value.pathOnly));
  return <BottomSheet title="Фільтри Oracle" onClose={onClose} actions={<Button onClick={() => { onApply?.({ type, pathOnly }); onClose?.(); }}>Показати карту</Button>}>
    <div className="filter-groups"><fieldset><legend>Тип вузла</legend><div>{types.map(([key, label]) => <button key={key} type="button" className={type === key ? "is-active" : ""} aria-pressed={type === key} onClick={() => setType(key)}>{label}</button>)}</div></fieldset><label className="switch-row"><span>Лише рекомендований шлях</span><input type="checkbox" checked={pathOnly} onChange={(event) => setPathOnly(event.target.checked)} /></label><p className="filter-note">Підтверджені зв’язки показані суцільною лінією, пропозиції AI — пунктиром.</p></div>
  </BottomSheet>;
}
