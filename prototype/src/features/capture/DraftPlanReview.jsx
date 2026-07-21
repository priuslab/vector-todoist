import { useEffect, useState } from "react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { StateView } from "../../components/StateView";
import { analyzeBrainDump, getGoals } from "./captureApi";
import { applyChangeSet, previewBrainDumpPlan } from "../today/todayApi";

const DEFAULT_PROFILE = {
  timezone: "Europe/Warsaw",
  workHours: { start: "09:00", end: "18:00" },
  energyPeak: { start: "09:30", end: "12:30" },
  focusBlockMinutes: 50,
  breakMinutes: 10,
  dailyLimitMinutes: 360,
};

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `draft-plan-${Date.now()}-key`;
}

function ukrainianCount(count, singular, few, many) {
  const remainder = Math.abs(count) % 100;
  if (remainder >= 11 && remainder <= 14) return many;
  switch (remainder % 10) {
    case 1: return singular;
    case 2:
    case 3:
    case 4: return few;
    default: return many;
  }
}

function savedCountMessage(tasks, ideas) {
  return `Збережено ${tasks} ${ukrainianCount(tasks, "задача", "задачі", "задач")} і ${ideas} ${ukrainianCount(ideas, "ідея", "ідеї", "ідей")}.`;
}

function ProposalList({ preview }) {
  return <>
    <section className="scheduled-preview" aria-label="Запропоновані задачі">
      <strong>Задачі</strong>
      {preview.tasks.map((task) => <span key={task.id}><b>{task.plannedStart ? new Date(task.plannedStart).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) : "Inbox"}</b>{task.title} · {task.estimatedMinutes} хв</span>)}
    </section>
    <section className="scheduled-preview" aria-label="Запропоновані ідеї">
      <strong>Ідеї в backlog</strong>
      {preview.ideas.map((idea) => <span key={idea.id}>{idea.text}</span>)}
    </section>
    {preview.warnings?.slice(0, 3).map((warning) => <p className="soft-copy" key={`${warning.code}-${warning.taskId ?? ""}`}>{warning.message}</p>)}
  </>;
}

export function DraftPlanReview({ draftId, apiClient, onNavigate = () => {} }) {
  const [goal, setGoal] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [key] = useState(idempotencyKey);
  const [now] = useState(() => new Date().toISOString());

  const prepare = async ({ useStoredGoal = false } = {}) => {
    if (!apiClient?.request) {
      setState("unavailable");
      return;
    }
    if (!draftId) {
      setState("missing");
      return;
    }
    setState("loading"); setError(""); setPreview(null);
    try {
      let activeGoal = useStoredGoal ? goal : null;
      if (!activeGoal) {
        const goals = await getGoals({ apiClient });
        activeGoal = Array.isArray(goals) ? goals.find((item) => item.status === "active") ?? null : null;
        setGoal(activeGoal);
      }
      if (!activeGoal) {
        setState("needs-goal");
        return;
      }
      const analyzed = await analyzeBrainDump({ apiClient, id: draftId });
      const nextAnalysis = analyzed?.analysis ?? null;
      setAnalysis(nextAnalysis);
      if (!nextAnalysis || nextAnalysis.questions?.length) {
        setState("needs-clarification");
        return;
      }
      const nextPreview = await previewBrainDumpPlan({ apiClient, id: draftId, goalId: activeGoal.id, profile: DEFAULT_PROFILE, busySlots: [], timezone: DEFAULT_PROFILE.timezone, now, idempotencyKey: key });
      setPreview(nextPreview);
      setState("ready");
    } catch {
      setError("Не вдалося підготувати пропозиції. Чернетка лишилась у Inbox — спробуй ще раз.");
      setState("error");
    }
  };

  useEffect(() => { prepare(); }, [draftId, apiClient]);

  const confirm = async () => {
    if (!preview?.changeSetId || applying) return;
    setApplying(true); setError("");
    try {
      const applied = await applyChangeSet({ apiClient, id: preview.changeSetId, idempotencyKey: key });
      setResult(applied);
    } catch {
      setError("Не вдалося зберегти пропозиції. Чернетка лишилась у Inbox — спробуй ще раз.");
    } finally {
      setApplying(false);
    }
  };

  const content = result ? <StateView state="success" title="Пропозиції збережено" message={savedCountMessage(result.tasks?.length ?? 0, result.ideas?.length ?? 0)} action={<div className="detail-actions"><Button onClick={() => onNavigate("today-normal")}>До плану на сьогодні</Button><Button variant="secondary" onClick={() => onNavigate("inbox-default")}>В Inbox</Button></div>} />
    : state === "loading" ? <StateView state="loading" title="Готую пропозиції" message="Перевіряю одну збережену чернетку та її зв’язок із головною метою." />
      : state === "unavailable" ? <StateView state="error" title="Потрібне підключення" message="Відкрий цю чернетку у підключеному застосунку, щоб підготувати реальні пропозиції." action={<Button onClick={() => onNavigate("inbox-drafts")}>В Inbox</Button>} />
        : state === "missing" ? <StateView state="error" title="Чернетку не знайдено" message="Повернись до Inbox і вибери збережений Brain Dump." action={<Button onClick={() => onNavigate("inbox-drafts")}>В Inbox</Button>} />
          : state === "needs-goal" ? <StateView state="empty" title="Спершу обери головну мету" message="Тоді Вектор зможе показати, як ця чернетка рухає тебе вперед." action={<Button onClick={() => onNavigate("goal-manual")}>Створити головну мету</Button>} />
            : state === "needs-clarification" ? <StateView state="warning" title="Потрібне уточнення" message={analysis?.questions?.[0]?.prompt ?? "Для цієї чернетки AI ще чекає на одне уточнення."} action={<Button onClick={() => onNavigate("inbox-drafts")}>В Inbox</Button>} />
              : state === "error" ? <StateView state="error" title="Не вдалося підготувати пропозиції" message="Чернетка лишилась у Inbox — спробуй ще раз." action={<Button onClick={() => prepare({ useStoredGoal: true })}>Спробувати ще раз</Button>} />
                : <><p className="soft-copy"><strong>Головна мета:</strong> {goal?.title}</p><p className="soft-copy"><strong>Рекомендація AI:</strong> {analysis?.summary}</p><ProposalList preview={preview} />{error ? <p role="alert" className="soft-copy">{error}</p> : null}</>;

  return <AppFrame title="Розбір Brain Dump" onBack={() => onNavigate("inbox-drafts")} noNav footer={state === "ready" && !result ? <Button loading={applying} onClick={confirm}>Зберегти пропозиції</Button> : null}>{content}</AppFrame>;
}
