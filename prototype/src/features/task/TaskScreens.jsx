import { CalendarBlank, Check, Clock, Flag, Lightning, Link, ListChecks, LockSimple } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";
import { StateView } from "../../components/StateView";
import { DEMO_GOAL, DEMO_TASKS } from "../../data/demoData";
import { completeTask, getTask, updateTask } from "../today/todayApi";
import { useEffect, useState } from "react";

const rows = [
  [CalendarBlank, "Коли", "Сьогодні, 09:30–10:30"],
  [Clock, "Тривалість", "60 хв"],
  [Flag, "Пріоритет", "Високий"],
  [Lightning, "Енергія", "Висока"],
  [LockSimple, "Планування", "Гнучка задача"],
  [Link, "Мета", "94% відповідності"],
];
const syncLabel = (status) => status === "synced" ? "Синхронізовано" : status === "attention" ? "Потрібне повторне підключення" : status === "sync_pending" || status === "pending" ? "Очікує синхронізації" : null;

export function TaskScreens({ screenId = "task-detail", onNavigate = () => {}, apiClient, taskId = "task-structure", onRetrySync }) {
  const [remoteTask, setRemoteTask] = useState(null);
  const [remoteError, setRemoteError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  useEffect(() => { if (!apiClient) return; let alive = true; getTask({ apiClient, id: taskId }).then((value) => alive && setRemoteTask(value)).catch(() => alive && setRemoteError("Не вдалося завантажити задачу. Спробуй оновити сторінку.")); return () => { alive = false; }; }, [apiClient, taskId]);
  if (apiClient && !remoteTask && !remoteError) return <AppFrame title="Задача" onBack={() => onNavigate("today-normal")} noNav><div className="form-stack"><StateView state="loading" title="Завантажую задачу" message="Вектор відкриває деталі задачі." /></div></AppFrame>;
  if (apiClient && remoteError) return <AppFrame title="Задача" onBack={() => onNavigate("today-normal")} noNav><StateView state="error" title="Задача недоступна" message={remoteError} action={<Button onClick={() => window.location.reload()}>Оновити</Button>} /></AppFrame>;
  const task = remoteTask ?? DEMO_TASKS[0];
  const save = async () => {
    if (!apiClient) { onNavigate("task-detail"); return; }
    setSaving(true); setMutationError("");
    try { const result = await updateTask({ apiClient, id: task.id, patch: { title: title.trim() || task.title }, idempotencyKey: `ui-edit-${task.id}-${Date.now()}` }); setRemoteTask(result.task ?? result); onNavigate("task-detail"); }
    catch (error) { setMutationError(error?.code === "CONFLICT" ? "Задача змінилася в іншому вікні. Онови деталі." : "Не вдалося зберегти зміни. Спробуй ще раз."); }
    finally { setSaving(false); }
  };
  const complete = async () => {
    if (!apiClient) { onNavigate("today-complete"); return; }
    setSaving(true); setMutationError("");
    try { const result = await completeTask({ apiClient, id: task.id, idempotencyKey: `ui-complete-${task.id}` }); setRemoteTask(result.task ?? result); }
    catch { setMutationError("Не вдалося завершити задачу. Спробуй ще раз."); }
    finally { setSaving(false); }
  };
  const retrySync = async () => {
    if (!apiClient || !task?.id) return;
    setSaving(true); setMutationError("");
    try { if (onRetrySync) await onRetrySync({ taskId: task.id, idempotencyKey: `calendar:create:${task.id}:${task.plannedStart}:${task.plannedEnd}` }); else throw new Error("RETRY_NOT_CONFIGURED"); }
    catch { setMutationError("Не вдалося повторити синхронізацію. Спробуй ще раз."); }
    finally { setSaving(false); }
  };
  if (screenId === "task-edit") return <AppFrame title="Редагувати задачу" onBack={() => onNavigate("task-detail")} noNav footer={<Button onClick={save} disabled={saving}>{saving ? "Зберігаю…" : "Зберегти зміни"}</Button>}><div className="form-stack">{mutationError ? <StateView state="error" title="Не вдалося зберегти" message={mutationError} /> : null}<label>Назва<textarea value={title || task.title} onChange={(event) => setTitle(event.target.value)} /></label><label>Опис<textarea defaultValue={task.description ?? "Скласти хук, ключові тези та завершення першого епізоду"} /></label><div className="form-grid"><label>Дата<input value="Сьогодні" readOnly /></label><label>Час<input value="09:30" readOnly /></label></div><div className="form-grid"><label>Тривалість<input value={`${task.estimatedMinutes ?? 60} хв`} readOnly /></label><label>Енергія<input value="Висока" readOnly /></label></div><label className="switch-row"><span><LockSimple size={19} />Дозволити AI переносити</span><input type="checkbox" defaultChecked /></label><label>Проєкт<input value="Пілотний епізод" readOnly /></label><label>Мета<input value={DEMO_GOAL.title} readOnly /></label></div></AppFrame>;
  if (screenId === "task-subtasks") return <AppFrame title="Підзадачі" onBack={() => onNavigate("task-detail")} noNav><section className="subtasks"><h1>{task.title}</h1>{["Сформулювати головний хук","Виписати 5 ключових тез","Додати завершальний заклик"].map((item,index) => <label key={item}><input type="checkbox" defaultChecked={index===0} /><span>{item}</span><small>::</small></label>)}<button className="add-row">+ Додати підзадачу</button></section><Button onClick={() => onNavigate("task-detail")}>Готово</Button></AppFrame>;
  if (screenId === "pomodoro-setup") return <AppFrame title="Фокус-сесія" onBack={() => onNavigate("task-detail")} noNav><section className="pomodoro"><span><Clock size={34} weight="duotone" /></span><h1>Як попрацюємо?</h1><p>{task.title}</p><div className="duration-pills"><button>25 хв</button><button className="is-active">50 хв</button><button>60 хв</button></div><label className="switch-row"><span>Увімкнути 10 хв перерви</span><input type="checkbox" defaultChecked /></label></section><Button onClick={() => onNavigate("focus-mode")}>Почати фокус</Button></AppFrame>;
  return <AppFrame title="Задача" onBack={() => onNavigate("today-normal")} activeRoute="today-normal" onNavigate={onNavigate}><section className="task-detail-hero"><span className="task-type">Deep Work</span><h1>{task.title}</h1><p>{task.description ?? "Підготувати хук, ключові тези й завершення для першого випуску."}</p>{syncLabel(task.syncStatus) ? <p className="sync-status" aria-live="polite">{syncLabel(task.syncStatus)}</p> : null}</section>{mutationError ? <StateView state="error" title="Дія не виконана" message={mutationError} /> : null}<InlineInsight title="Чому зараз">Це твій пік енергії та найкоротший наступний крок до пілотного епізоду.</InlineInsight><div className="task-properties">{rows.map(([Icon,label,value]) => <button key={label} onClick={() => onNavigate("task-edit")}><Icon size={19} /><span><small>{label}</small><strong>{value}</strong></span></button>)}</div><button className="subtask-link" onClick={() => onNavigate("task-subtasks")}><ListChecks size={20} /><span><strong>Підзадачі</strong><small>1 з 3 виконано</small></span></button><div className="detail-actions"><Button onClick={() => onNavigate("pomodoro-setup")}>Почати фокус</Button>{task.syncStatus === "sync_pending" || task.syncStatus === "attention" ? <Button variant="secondary" onClick={retrySync} disabled={saving}>Повторити синхронізацію</Button> : <Button variant="secondary" onClick={() => onNavigate("task-edit")}>Редагувати</Button>}<Button variant="tertiary" onClick={complete} disabled={saving || task.status === "completed"}>{task.status === "completed" ? "Виконано" : saving ? "Завершую…" : "Виконати задачу"}</Button></div></AppFrame>;
}
