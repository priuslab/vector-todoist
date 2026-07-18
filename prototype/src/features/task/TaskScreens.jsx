import { CalendarBlank, Check, Clock, Flag, Lightning, Link, ListChecks, LockSimple } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";
import { DEMO_GOAL, DEMO_TASKS } from "../../data/demoData";

const rows = [
  [CalendarBlank, "Коли", "Сьогодні, 09:30–10:30"],
  [Clock, "Тривалість", "60 хв"],
  [Flag, "Пріоритет", "Високий"],
  [Lightning, "Енергія", "Висока"],
  [LockSimple, "Планування", "Гнучка задача"],
  [Link, "Мета", "94% відповідності"],
];

export function TaskScreens({ screenId = "task-detail", onNavigate = () => {} }) {
  const task = DEMO_TASKS[0];
  if (screenId === "task-edit") return <AppFrame title="Редагувати задачу" onBack={() => onNavigate("task-detail")} noNav><div className="form-stack"><label>Назва<textarea defaultValue={task.title} /></label><label>Опис<textarea defaultValue="Скласти хук, ключові тези та завершення першого епізоду" /></label><div className="form-grid"><label>Дата<input value="Сьогодні" readOnly /></label><label>Час<input value="09:30" readOnly /></label></div><div className="form-grid"><label>Тривалість<input value="60 хв" readOnly /></label><label>Енергія<input value="Висока" readOnly /></label></div><label className="switch-row"><span><LockSimple size={19} />Дозволити AI переносити</span><input type="checkbox" defaultChecked /></label><label>Проєкт<input value="Пілотний епізод" readOnly /></label><label>Мета<input value={DEMO_GOAL.title} readOnly /></label></div><div className="detail-actions"><Button onClick={() => onNavigate("task-detail")}>Зберегти зміни</Button></div></AppFrame>;
  if (screenId === "task-subtasks") return <AppFrame title="Підзадачі" onBack={() => onNavigate("task-detail")} noNav><section className="subtasks"><h1>{task.title}</h1>{["Сформулювати головний хук","Виписати 5 ключових тез","Додати завершальний заклик"].map((item,index) => <label key={item}><input type="checkbox" defaultChecked={index===0} /><span>{item}</span><small>::</small></label>)}<button className="add-row">+ Додати підзадачу</button></section><Button onClick={() => onNavigate("task-detail")}>Готово</Button></AppFrame>;
  if (screenId === "pomodoro-setup") return <AppFrame title="Фокус-сесія" onBack={() => onNavigate("task-detail")} noNav><section className="pomodoro"><span><Clock size={34} weight="duotone" /></span><h1>Як попрацюємо?</h1><p>{task.title}</p><div className="duration-pills"><button>25 хв</button><button className="is-active">50 хв</button><button>60 хв</button></div><label className="switch-row"><span>Увімкнути 10 хв перерви</span><input type="checkbox" defaultChecked /></label></section><Button onClick={() => onNavigate("focus-mode")}>Почати фокус</Button></AppFrame>;
  return <AppFrame title="Задача" onBack={() => onNavigate("today-normal")} activeRoute="today-normal" onNavigate={onNavigate}><section className="task-detail-hero"><span className="task-type">Deep Work</span><h1>{task.title}</h1><p>Підготувати хук, ключові тези й завершення для першого випуску.</p></section><InlineInsight title="Чому зараз">Це твій пік енергії та найкоротший наступний крок до пілотного епізоду.</InlineInsight><div className="task-properties">{rows.map(([Icon,label,value]) => <button key={label} onClick={() => onNavigate("task-edit")}><Icon size={19} /><span><small>{label}</small><strong>{value}</strong></span></button>)}</div><button className="subtask-link" onClick={() => onNavigate("task-subtasks")}><ListChecks size={20} /><span><strong>Підзадачі</strong><small>1 з 3 виконано</small></span></button><div className="detail-actions"><Button onClick={() => onNavigate("pomodoro-setup")}>Почати фокус</Button><Button variant="secondary" onClick={() => onNavigate("task-edit")}>Редагувати</Button></div></AppFrame>;
}
