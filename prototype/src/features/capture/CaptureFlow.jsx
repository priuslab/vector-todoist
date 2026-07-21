import { useEffect, useRef, useState } from "react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { StateView } from "../../components/StateView";
import { VoiceTextComposer } from "../../components/VoiceTextComposer";
import { DEMO_BRAIN_DUMP } from "../../data/demoData";
import { AIProcessing } from "./AIProcessing";
import { AIResult } from "./AIResult";
import { Clarification } from "./Clarification";
import { Transcript } from "./Transcript";
import { analyzeBrainDump, answerBrainDump, createTextBrainDump, getBrainDumpResult } from "./captureApi";
import { previewBrainDumpPlan, applyChangeSet } from "../today/todayApi";

export function CaptureFlow({ screenId = "capture-chooser", onBack, onNavigate = () => {}, processingDelayMs = 1400, apiClient, createBrainDump = createTextBrainDump, analyze = analyzeBrainDump, answer = answerBrainDump, fetchResult = getBrainDumpResult }) {
  const initial = screenId.replace("capture-", "");
  const [stage, setStage] = useState(initial === "chooser" ? "chooser" : initial);
  const [draftText, setDraftText] = useState("");
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
  const [voiceBlob, setVoiceBlob] = useState(null);
  const voiceRequestInFlight = useRef(false);
  const [idempotencyKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-brain-dump`);

  useEffect(() => {
    if (stage !== "processing" || apiClient) return undefined;
    const timer = window.setTimeout(() => setStage("question-1"), processingDelayMs);
    return () => window.clearTimeout(timer);
  }, [processingDelayMs, stage]);

  const saveDraft = async (text = draftText) => {
    setSaveError(false); setSaving(true);
    let draft;
    try {
      draft = await createBrainDump({ apiClient, text, idempotencyKey });
    } catch {
      setSaveError(true); setSaving(false);
      return;
    }
    setDraftId(draft.id);
    if (!apiClient) { setSaving(false); setStage("saved"); return; }
    setAnalysisError(""); setStage("processing");
    try {
      const result = await analyze({ apiClient, id: draft.id });
      setAnalysis(result.analysis); setStage(result.analysis.questions?.length ? "clarification" : "result");
    } catch {
      setAnalysisError("Не вдалося завершити аналіз. Чернетку збережено — спробуй ще раз.");
    } finally {
      setSaving(false);
    }
  };

  const transcribeVoice = async (blob) => {
    if (voiceRequestInFlight.current) return undefined;

    voiceRequestInFlight.current = true;
    setVoiceBlob(blob);
    setVoiceError(""); setVoiceLoading(true);
    try {
      if (!apiClient) {
        setVoiceError("Голосове розпізнавання доступне у підключеному застосунку. Тут можеш продовжити текстом або спробувати ще раз після підключення.");
        setStage("voice-retry");
        return "";
      }

      const result = await apiClient.request("/api/v1/brain-dumps/voice", { method: "POST", headers: { "Content-Type": blob.type || "audio/webm", "X-Audio-Duration": "23" }, body: blob });
      const transcript = typeof result?.transcript === "string" ? result.transcript.trim() : "";
      if (!transcript) throw new Error("Voice transcription returned no text");
      setDraftText(transcript);
      setStage("voice-review");
      return transcript;
    } catch {
      setVoiceError("Не вдалося розпізнати запис. Запис збережено для повторної спроби — або можеш написати думки текстом."); setStage("voice-retry");
      throw new Error("Voice transcription failed");
    } finally {
      voiceRequestInFlight.current = false;
      setVoiceLoading(false);
    }
  };

  const submitComposerText = (text) => {
    setDraftText(text);
    return saveDraft(text);
  };

  const transcribeClarificationAnswer = async (blob) => {
    if (!apiClient) throw new Error("Voice transcription is unavailable");
    const result = await apiClient.request("/api/v1/brain-dumps/voice", {
      method: "POST",
      headers: { "Content-Type": blob.type || "audio/webm", "X-Audio-Duration": "23" },
      body: blob,
    });
    const transcript = typeof result?.transcript === "string" ? result.transcript.trim() : "";
    if (!transcript) throw new Error("Voice transcription returned no text");
    return transcript;
  };

  const submitAnswer = async (answerText) => {
    if (!analysis?.questions?.[0] || !answerText) return;
    setAnalysisError(""); setStage("processing");
    try {
      const result = await answer({ apiClient, id: draftId, answers: [{ id: analysis.questions[0].id, text: answerText }] });
      setAnalysis(result.analysis); setStage(result.analysis.questions?.length ? "clarification" : "result");
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
    try {
      await applyChangeSet({ apiClient, id: preview.changeSetId, idempotencyKey });
      const allTasksAreInInbox = preview.tasks?.length > 0 && preview.tasks.every((task) => task.status === "inbox");
      onNavigate(allTasksAreInInbox ? "inbox-default" : "today-normal");
    }
    catch { setPlanError("План не застосовано. Жодна задача не загубилась — спробуй ще раз."); }
    finally { setApplying(false); }
  };

  const composer = <><VoiceTextComposer onTranscribe={transcribeVoice} onSubmit={submitComposerText} submitLabel="Зберегти чернетку" disabled={voiceLoading || saving} />{saveError ? <p role="alert" className="soft-copy">Не вдалося зберегти. Перевір з’єднання й спробуй ще раз.</p> : null}</>;
  const body = stage === "chooser" ? <section className="capture-chooser"><h1>Що зараз у голові?</h1><p>Говори хаотично — не треба формулювати задачі чи оцінювати час.</p>{composer}</section>
    : stage === "recording" ? composer
    : stage === "voice-retry" ? <section className="capture-transcript"><h1>Не вдалося розпізнати запис</h1><p role="alert" className="soft-copy">{voiceError}</p><Button loading={voiceLoading} onClick={() => voiceBlob && transcribeVoice(voiceBlob)}>Спробувати ще раз</Button><Button variant="secondary" disabled={voiceLoading} onClick={() => setStage("transcript")}>Написати текстом</Button></section>
    : stage === "voice-review" ? <section className="capture-transcript"><h1>Перевір транскрипт</h1><p className="soft-copy">Відредагуй текст перед збереженням у Brain Dump.</p><Transcript editable value={draftText} onChange={setDraftText} />{voiceError ? <p role="alert" className="soft-copy">{voiceError}</p> : null}<Button loading={saving} onClick={() => saveDraft()}>Зберегти чернетку</Button><Button variant="secondary" onClick={() => setStage("recording")}>Записати ще раз</Button></section>
    : stage === "transcript" ? <section className="capture-transcript"><h1>Твої думки</h1><Transcript editable value={draftText} onChange={setDraftText} />{saveError ? <p role="alert" className="soft-copy">Не вдалося зберегти. Перевір з’єднання й спробуй ще раз.</p> : null}<Button loading={saving} onClick={() => saveDraft()}>Зберегти чернетку</Button></section>
    : stage === "saved" ? <section className="capture-transcript"><h1>Думки збережено</h1><p role="status" className="soft-copy">Збережено як чернетку. Вектор повернеться до них, коли ти будеш готовий.</p><Transcript value={draftText} /><Button onClick={() => onNavigate("inbox-drafts")}>Відкрити збережену чернетку</Button></section>
    : stage === "processing" ? <AIProcessing error={analysisError} onRetry={retryAnalysis} />
    : stage === "question-1" ? <Clarification number={1} onAnswer={() => setStage("question-2")} />
    : stage === "question-2" ? <Clarification number={2} onAnswer={() => setStage("result")} />
    : stage === "clarification" ? <Clarification questions={analysis?.questions} deferSubmit onTranscribe={transcribeClarificationAnswer} onAnswer={submitAnswer} />
    : stage === "result" ? <AIResult analysis={analysis} preview={preview} applying={applying} error={planError} onViewDay={openPlanPreview} onApply={applyPlan} onUndo={() => setStage("chooser")} />
    : stage === "review" ? <section className="capture-transcript"><h1>Перевір транскрипт</h1><p className="soft-copy">Аудіо було тихим у кількох місцях. Відредагуй текст або запиши ще раз.</p><Transcript editable /><Button onClick={() => setStage("processing")}>Повторити обробку</Button></section>
    : <StateView state="error" title="Не вдалося опрацювати" message={`Brain Dump збережено в Inbox: «${DEMO_BRAIN_DUMP.slice(0, 58)}…»`} action={<Button onClick={() => setStage("processing")}>Спробувати ще раз</Button>} />;

  return <AppFrame title="Brain Dump" eyebrow="AI-асистент" onBack={onBack} noNav>{body}</AppFrame>;
}
