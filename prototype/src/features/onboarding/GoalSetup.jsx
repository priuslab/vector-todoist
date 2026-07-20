import { Compass, MagicWand, PencilSimple, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { VoiceTextComposer } from "../../components/VoiceTextComposer";
import { DEMO_GOAL } from "../../data/demoData";

const DEMO_GOAL_ANSWER_TRANSCRIPT = "Хочу знайти одну опорну мету і рухатися до неї без перевантаження.";

export function GoalSetup({ screenId, onBack, onNext, onRoute, apiClient, demoMode = false }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [deadline, setDeadline] = useState("2026-09-30");
  const start = async () => {
    setError(""); setLoading(true);
    try {
      const result = apiClient ? await apiClient.request("/api/v1/goals/discovery/sessions", { method: "POST" }) : { id: "demo", status: "active", questions: [{ id: "attention", prompt: "Що зараз забирає найбільше твоєї уваги?" }], answers: [], safetyNotice: "Це рекомендація для планування, а не медична чи психологічна оцінка." };
      setSession(result); onRoute("goal-test-question");
    } catch { setError("Не вдалося почати діалог. Спробуй ще раз."); } finally { setLoading(false); }
  };
  const submitAnswer = async (answerText) => {
    const text = answerText.trim();
    if (!session || !text) return;
    setError(""); setLoading(true);
    try {
      const question = session.questions?.find((item) => !session.answers?.some((saved) => saved.id === item.id)) ?? session.questions?.[0];
      const result = apiClient && session.id !== "demo"
        ? await apiClient.request(`/api/v1/goals/discovery/sessions/${session.id}/answers`, { method: "POST", body: JSON.stringify([{ id: question.id, text }]), headers: { "content-type": "application/json" } })
        : { ...session, answers: [...(session.answers ?? []), { id: question.id, text }], suggestion: { title: text, rationale: "Чернетка на основі твоєї відповіді.", confidence: 0.7, safetyNotice: session.safetyNotice, editable: true } };
      setSession(result); if (result.suggestion) onRoute("goal-test-result");
    } catch { setError("Не вдалося зберегти відповідь. Перевір з’єднання і повтори."); } finally { setLoading(false); }
  };
  const transcribeGoalAnswer = async (blob) => {
    if (apiClient) {
      const result = await apiClient.request("/api/v1/brain-dumps/voice", {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      return result.transcript ?? "";
    }
    if (demoMode) return DEMO_GOAL_ANSWER_TRANSCRIPT;
    throw new Error("Voice transcription is unavailable");
  };
  const suggestion = session?.suggestion ?? { title: DEMO_GOAL.title, rationale: "Рекомендація на основі твоїх пріоритетів. Її можна змінити.", confidence: 0.92, safetyNotice: "Це рекомендація для планування, а не медична чи психологічна оцінка.", editable: true };
  const saveEditedSuggestion = async () => { const title = editedTitle.trim(); if (!title) return; try { const result = apiClient && session?.id !== "demo" ? await apiClient.request(`/api/v1/goals/discovery/sessions/${session.id}/suggestion`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, rationale: suggestion.rationale }) }) : { ...session, suggestion: { ...suggestion, title } }; if (result) setSession(result); setEditing(false); } catch { setError("Не вдалося зберегти зміни. Спробуй ще раз."); } };
  const question = session?.questions?.find((item) => !session.answers?.some((saved) => saved.id === item.id)) ?? session?.questions?.[0];
  const footerByScreen = {
    "goal-manual": <Button onClick={onNext}>Зберегти мету</Button>,
    "goal-test-start": <Button onClick={start} disabled={loading}>{loading ? "Готую діалог…" : "Почати короткий діалог"}</Button>,
    "goal-test-result": <><Button onClick={onNext}>Підтвердити мету</Button><button className="text-action" onClick={() => setEditing(true)}>Відредагувати</button></>,
    "goal-skip-warning": <><Button onClick={onNext}>Все одно продовжити</Button><button className="text-action" onClick={() => onRoute("goal-choice")}>Повернутися до вибору</button></>,
  };
  const centered = ["goal-test-start", "goal-test-question", "goal-test-result", "goal-skip-warning"].includes(screenId);
  const twoRows = ["goal-test-result", "goal-skip-warning"].includes(screenId);
  return <AppFrame title="Головна мета" eyebrow="Крок 3 з 4" onBack={onBack} noNav footer={footerByScreen[screenId]} footerRows={twoRows ? 2 : 1} contentAlign={centered ? "center" : "start"}>
    {screenId === "goal-choice" ? <><div className="section-heading"><h1>Що для тебе зараз найважливіше?</h1><p>Одна мета безкоштовна. Вона допомагає Oracle відрізняти важливе від шуму.</p></div><div className="choice-list"><button onClick={() => onRoute("goal-manual")}><PencilSimple size={23} /><span><strong>Ввести вручну</strong><small>Я вже знаю, чого хочу</small></span></button><button onClick={() => onRoute("goal-test-start")}><MagicWand size={23} /><span><strong>Визначити з AI</strong><small>Короткий діалог без тиску</small></span></button><button onClick={() => onRoute("goal-skip-warning")}><Compass size={23} /><span><strong>Продовжити без мети</strong><small>Працюватиме як розумний to-do</small></span></button></div></> : null}
    {screenId === "goal-manual" ? <><div className="section-heading"><h1>Сформулюй свою мету</h1><p>Можна неідеально — Вектор допоможе зробити її конкретнішою.</p></div><div className="form-stack"><label>Головна мета<textarea defaultValue={DEMO_GOAL.title} /></label><label>Чому це важливо?<textarea defaultValue="Хочу створити корисний проєкт і перевірити формат" /></label><label htmlFor="goal-deadline">Строк<input id="goal-deadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div></> : null}
    {screenId === "goal-test-start" ? <><div className="onboarding-hero"><span><MagicWand size={34} weight="duotone" /></span><h1>Знайдемо одну опорну мету</h1><p>AI поставить кілька коротких запитань про твої пріоритети. Це рекомендація для планування, не медична чи психологічна оцінка.</p></div><div className="conversation-preview"><span>Що зараз забирає найбільше твоєї уваги?</span><span>Який результат дав би відчуття руху вперед?</span></div></> : null}
    {screenId === "goal-test-question" ? <section className="goal-test-result-content"><div className="section-heading"><span className="success-chip">{session?.answers?.length ?? 0} з {session?.questions?.length ?? 3}</span><h1>{question?.prompt ?? "Що зараз для тебе найважливіше?"}</h1><p>Відповідай своїми словами. Це не тест і не діагностика.</p></div><VoiceTextComposer key={question?.id} onTranscribe={transcribeGoalAnswer} onSubmit={submitAnswer} submitLabel="Відповісти" disabled={loading} />{error ? <p role="alert" className="error-text">{error}</p> : null}</section> : null}
    {screenId === "goal-test-result" ? <section className="goal-test-result-content"><div className="section-heading"><span className="success-chip">Рекомендація AI · {Math.round((suggestion.confidence ?? 0) * 100)}%</span><h1>Твоя опорна мета</h1><p>{suggestion.rationale}</p></div>{editing ? <div className="form-stack"><label>Формулювання мети<textarea value={editedTitle || suggestion.title} onChange={(event) => setEditedTitle(event.target.value)} /></label><button className="text-action" onClick={saveEditedSuggestion}>Зберегти зміни</button></div> : <div className="goal-result"><strong>{suggestion.title}</strong><span>{suggestion.safetyNotice}</span></div>}</section> : null}
    {screenId === "goal-skip-warning" ? <div className="onboarding-hero onboarding-hero--warning"><span><WarningCircle size={34} weight="duotone" /></span><h1>Можна продовжити без мети</h1><p>Задачі, календар і нагадування працюватимуть. Але Oracle не зможе показати найкоротший шлях і відповідність ідей.</p></div> : null}
    {error && screenId !== "goal-test-question" ? <p role="alert" className="error-text">{error}</p> : null}
  </AppFrame>;
}
