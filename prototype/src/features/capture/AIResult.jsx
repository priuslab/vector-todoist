import { ArrowRight, CheckCircle, Folder, Lightbulb, ListChecks } from "@phosphor-icons/react";
import { Button } from "../../components/Button";
import { UndoSnackbar } from "../../components/UndoSnackbar";

export function AIResult({ onViewDay, onApply, onUndo, analysis, preview, applying, error }) {
  if (analysis) {
    return <section className="ai-result"><div className="result-hero"><CheckCircle size={38} weight="duotone" /><span><h1>{preview ? "План готовий до застосування" : "Аналіз готовий"}</h1><p>{analysis.summary}</p></span></div><p className="soft-copy"><strong>Рекомендація AI:</strong> впевненість {Math.round(analysis.confidence * 100)}%. {preview ? "Перевір план і застосуй його, коли будеш готовий." : "Перевір пропозиції перед додаванням у план."}</p><div className="result-summary">{(preview?.tasks ?? analysis.tasks).slice(0, 3).map((task) => <div key={task.id ?? task.title}><ListChecks size={21} /><span><strong>{task.title}</strong><small>{task.estimatedMinutes} хв · {task.priority}</small></span></div>)}{(preview?.ideas ?? analysis.ideas).slice(0, 3).map((idea) => <div key={idea.id ?? idea.text}><Lightbulb size={21} /><span><strong>Ідея</strong><small>{idea.summary}</small></span></div>)}</div>{error ? <p role="alert" className="soft-copy">{error}</p> : null}<div className="scheduled-preview"><strong>{preview ? "План на сьогодні" : "Контекст"}</strong>{(preview?.warnings ?? analysis.context).slice(0, 3).map((item) => <span key={typeof item === "string" ? item : item.message}>{typeof item === "string" ? item : item.message}</span>)}</div>{preview ? <Button icon={ArrowRight} loading={applying} onClick={onApply}>Застосувати план</Button> : <Button icon={ArrowRight} onClick={onViewDay}>Переглянути пропозиції</Button>}</section>;
  }
  return (
    <section className="ai-result">
      <div className="result-hero"><CheckCircle size={38} weight="duotone" /><span><h1>План готовий</h1><p>Я знайшов місце для важливого й залишив ідеї в backlog.</p></span></div>
      <div className="result-summary">
        <div><ListChecks size={21} /><span><strong>3 задачі</strong><small>09:30, 12:00, 17:10</small></span></div>
        <div><Lightbulb size={21} /><span><strong>2 ідеї</strong><small>Збережено в backlog</small></span></div>
        <div><Folder size={21} /><span><strong>1 проєкт</strong><small>Пілотний епізод</small></span></div>
      </div>
      <div className="scheduled-preview"><strong>Сьогодні</strong><span><b>09:30</b>Підготувати структуру першого епізоду</span><span className="locked"><b>11:00</b>Командний синк · Google</span><span><b>12:00</b>Написати лист потенційному гостю</span></div>
      <Button icon={ArrowRight} onClick={onViewDay}>Переглянути день</Button>
      <UndoSnackbar message="5 змін застосовано" onUndo={onUndo} />
    </section>
  );
}
