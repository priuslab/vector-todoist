import { ArrowRight, CheckCircle, Folder, Lightbulb, ListChecks } from "@phosphor-icons/react";
import { Button } from "../../components/Button";
import { UndoSnackbar } from "../../components/UndoSnackbar";

export function AIResult({ onViewDay, onUndo, analysis }) {
  if (analysis) {
    return <section className="ai-result"><div className="result-hero"><CheckCircle size={38} weight="duotone" /><span><h1>Аналіз готовий</h1><p>{analysis.summary}</p></span></div><p className="soft-copy"><strong>Рекомендація AI:</strong> впевненість {Math.round(analysis.confidence * 100)}%. Перевір пропозиції перед додаванням у план.</p><div className="result-summary">{analysis.tasks.slice(0, 3).map((task) => <div key={task.title}><ListChecks size={21} /><span><strong>{task.title}</strong><small>{task.estimatedMinutes} хв · {task.priority}</small></span></div>)}{analysis.ideas.slice(0, 3).map((idea) => <div key={idea.text}><Lightbulb size={21} /><span><strong>Ідея</strong><small>{idea.summary}</small></span></div>)}</div><div className="scheduled-preview"><strong>Контекст</strong>{analysis.context.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div><Button icon={ArrowRight} onClick={onViewDay}>Переглянути пропозиції</Button></section>;
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
