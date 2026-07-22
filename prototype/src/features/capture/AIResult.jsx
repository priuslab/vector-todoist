import { ArrowRight, CheckCircle, Folder, Lightbulb, ListChecks } from "@phosphor-icons/react";
import { Button } from "../../components/Button";
import { UndoSnackbar } from "../../components/UndoSnackbar";

export function AIResult({ tasks = [], onApply, actionLabel = "Застосувати план", applying = false, onUndo }) {
  return (
    <section className="ai-result">
      <div className="result-hero"><CheckCircle size={38} weight="duotone" /><span><h1>План готовий</h1><p>Я знайшов місце для важливого й залишив ідеї в backlog.</p></span></div>
      <div className="result-summary">
        <div><ListChecks size={21} /><span><strong>{tasks.length} {tasks.length === 1 ? "задача" : "задачі"}</strong><small>{tasks.map((task) => task.start).join(", ")}</small></span></div>
        <div><Lightbulb size={21} /><span><strong>2 ідеї</strong><small>Збережено в backlog</small></span></div>
        <div><Folder size={21} /><span><strong>1 проєкт</strong><small>Пілотний епізод</small></span></div>
      </div>
      <div className="scheduled-preview"><strong>Сьогодні</strong>{tasks.map((task) => <span key={task.id}><b>{task.start}</b>{task.title} · {task.priority} пріоритет · {task.deadline}</span>)}<span className="locked"><b>11:00</b>Командний синк · Google</span></div>
      <Button icon={ArrowRight} loading={applying} onClick={onApply}>{actionLabel}</Button>
      <UndoSnackbar message="План можна застосувати одним кроком" onUndo={onUndo} />
    </section>
  );
}
