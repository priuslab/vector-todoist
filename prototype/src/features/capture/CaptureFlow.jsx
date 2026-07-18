import { useEffect, useState } from "react";
import { Keyboard, Microphone } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { StateView } from "../../components/StateView";
import { DEMO_BRAIN_DUMP } from "../../data/demoData";
import { AIProcessing } from "./AIProcessing";
import { AIResult } from "./AIResult";
import { Clarification } from "./Clarification";
import { Transcript } from "./Transcript";
import { VoiceRecorder } from "./VoiceRecorder";
import { analyzeBrainDump, answerBrainDump, createTextBrainDump, getBrainDumpResult } from "./captureApi";
import { previewBrainDumpPlan, applyChangeSet } from "../today/todayApi";

export function CaptureFlow({ screenId = "capture-chooser", onBack, onNavigate = () => {}, processingDelayMs = 1400, apiClient, createBrainDump = createTextBrainDump, analyze = analyzeBrainDump, answer = answerBrainDump, fetchResult = getBrainDumpResult }) {
  const initial = screenId.replace("capture-", "");
  const [stage, setStage] = useState(initial === "chooser" ? "chooser" : initial);
  const [draftText, setDraftText] = useState(DEMO_BRAIN_DUMP);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [draftId, setDraftId] = useState("");
  const [preview, setPreview] = useState(null);
  const [applying, setApplying] = useState(false);
  const [planError, setPlanError] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [idempotencyKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-brain-dump`);

  useEffect(() => {
    if (stage !== "processing" || apiClient) return undefined;
    const timer = window.setTimeout(() => setStage("question-1"), processingDelayMs);
    return () => window.clearTimeout(timer);
  }, [processingDelayMs, stage]);

  const saveDraft = async () => {
    setSaveError(false); setSaving(true);
    try {
      const draft = await createBrainDump({ apiClient, text: draftText, idempotencyKey });
      setDraftId(draft.id);
      if (!apiClient) { setStage("saved"); return; }
      setAnalysisError(""); setStage("processing");
      const result = await analyze({ apiClient, id: draft.id });
      const persisted = await fetchResult({ apiClient, id: draft.id });
      const liveResult = persisted?.analysis ? persisted : result;
      setAnalysis(liveResult.analysis); setStage(liveResult.analysis.questions?.length ? "clarification" : "result");
    } catch {
      if (apiClient) { setAnalysisError("Не вдалося завершити аналіз. Чернетку збережено — спробуй ще раз."); setStage("processing"); }
      else setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const finishVoice = async (blob) => {
    if (!apiClient) { setStage("processing"); return; }
    setVoiceError(""); setVoiceLoading(true); setStage("voice-uploading");
    try {
      const result = await apiClient.request("/api/v1/brain-dumps/voice", { method: "POST", headers: { "Content-Type": blob.type || "audio/webm", "X-Audio-Duration": "23" }, body: blob });
      setDraftText(result.transcript ?? ""); setStage("voice-review");
    } catch { setVoiceError("Не вдалося розпізнати запис. Чернетка голосу не збережена — спробуй ще раз або напиши текстом."); setStage("recording"); }
    finally { setVoiceLoading(false); }
  };

  const submitAnswer = async (answerText) => {
    if (!analysis?.questions?.[0] || !answerText) return;
    setAnalysisError(""); setStage("processing");
    try {
      const result = await answer({ apiClient, id: draftId, answers: [{ id: analysis.questions[0].id, text: answerText }] });
      const persisted = await fetchResult({ apiClient, id: draftId });
      const liveResult = persisted?.analysis ? persisted : result;
      setAnalysis(liveResult.analysis); setStage(liveResult.analysis.questions?.length ? "clarification" : "result");
    } catch { setAnalysisError("Не вдалося зберегти уточнення. Спробуй ще раз."); setStage("clarification"); }
  };

  const retryAnalysis = async () => {
    if (!apiClient || !draftId) return;
    setAnalysisError(""); setStage("processing");
    try {
      const result = await analyze({ apiClient, id: draftId });
      setAnalysis(result.analysis); setStage(result.analysis.questions?.length ? "clarification" : "result");
    } catch { setAnalysisError("Не вдалося завершити аналіз. Чернетку збережено — спробуй ще раз."); }
  };

  const openPlanPreview = async () => {
    if (!apiClient || !draftId) return onNavigate("today-normal");
    setPlanError("");
    try {
      const result = await previewBrainDumpPlan({ apiClient, id: draftId, idempotencyKey });
      setPreview(result);
    } catch { setPlanError("Не вдалося підготувати план. Дані збережено — спробуй ще раз."); }
  };
  const applyPlan = async () => {
    if (!apiClient || !preview?.changeSetId) return onNavigate("today-normal");
    setApplying(true); setPlanError("");
    try { await applyChangeSet({ apiClient, id: preview.changeSetId, idempotencyKey }); onNavigate("today-normal"); }
    catch { setPlanError("План не застосовано. Жодна задача не загубилась — спробуй ще раз."); }
    finally { setApplying(false); }
  };

  const body = stage === "chooser" ? <section className="capture-chooser"><span className="capture-orb"><Microphone size={38} weight="duotone" /></span><h1>Що зараз у голові?</h1><p>Говори хаотично — не треба формулювати задачі чи оцінювати час.</p><div className="capture-options"><Button icon={Microphone} onClick={() => setStage("recording")}>Диктувати</Button><Button variant="secondary" icon={Keyboard} onClick={() => setStage("transcript")}>Написати текстом</Button></div></section>
    : stage === "recording" ? <VoiceRecorder demo={!apiClient} transcript="Мені треба підготувати перший випуск…" onCancel={() => setStage("chooser")} onFinish={finishVoice} />
    : stage === "voice-uploading" ? <AIProcessing error={voiceLoading ? "Завантажую запис і готую транскрипт…" : voiceError} />
    : stage === "voice-review" ? <section className="capture-transcript"><h1>Перевір транскрипт</h1><p className="soft-copy">Відредагуй текст перед збереженням у Brain Dump.</p><Transcript editable value={draftText} onChange={setDraftText} />{voiceError ? <p role="alert" className="soft-copy">{voiceError}</p> : null}<Button loading={saving} onClick={saveDraft}>Зберегти чернетку</Button><Button variant="secondary" onClick={() => setStage("recording")}>Записати ще раз</Button></section>
    : stage === "transcript" ? <section className="capture-transcript"><h1>Твої думки</h1><Transcript editable value={draftText} onChange={setDraftText} />{saveError ? <p role="alert" className="soft-copy">Не вдалося зберегти. Перевір з’єднання й спробуй ще раз.</p> : null}<Button loading={saving} onClick={saveDraft}>Зберегти чернетку</Button></section>
    : stage === "saved" ? <section className="capture-transcript"><h1>Думки збережено</h1><p role="status" className="soft-copy">Збережено як чернетку. Вектор повернеться до них, коли ти будеш готовий.</p><Transcript value={draftText} /><Button onClick={() => onNavigate("inbox-default")}>Перейти до Inbox</Button></section>
    : stage === "processing" ? <AIProcessing error={analysisError} onRetry={retryAnalysis} />
    : stage === "question-1" ? <Clarification number={1} onAnswer={() => setStage("question-2")} />
    : stage === "question-2" ? <Clarification number={2} onAnswer={() => setStage("result")} />
    : stage === "clarification" ? <Clarification questions={analysis?.questions} deferSubmit onAnswer={submitAnswer} />
    : stage === "result" ? <AIResult analysis={analysis} preview={preview} applying={applying} error={planError} onViewDay={openPlanPreview} onApply={applyPlan} onUndo={() => setStage("chooser")} />
    : stage === "review" ? <section className="capture-transcript"><h1>Перевір транскрипт</h1><p className="soft-copy">Аудіо було тихим у кількох місцях. Відредагуй текст або запиши ще раз.</p><Transcript editable /><Button onClick={() => setStage("processing")}>Повторити обробку</Button></section>
    : <StateView state="error" title="Не вдалося опрацювати" message={`Brain Dump збережено в Inbox: «${DEMO_BRAIN_DUMP.slice(0, 58)}…»`} action={<Button onClick={() => setStage("processing")}>Спробувати ще раз</Button>} />;

  return <AppFrame title="Brain Dump" eyebrow="AI-асистент" onBack={onBack} noNav>{body}</AppFrame>;
}
