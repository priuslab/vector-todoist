import { useCallback, useEffect, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";

export const VOICE_TEXT_COMPOSER_STATUSES = [
  "idle",
  "listening",
  "transcribing",
  "draft",
  "submitting",
  "responding",
  "error",
];

export function VoiceTextComposer({
  initialMode = "voice",
  status: externalStatus,
  responseText,
  onTranscribe,
  onSubmit,
  onSpeak,
  submitLabel = "Відправити",
  disabled = false,
}) {
  const [mode, setMode] = useState(initialMode === "text" ? "text" : "voice");
  const [draft, setDraft] = useState("");
  const [composerStatus, setComposerStatus] = useState(initialMode === "text" ? "draft" : "idle");
  const [voiceError, setVoiceError] = useState("");

  const completeRecording = useCallback(async (blob) => {
    setComposerStatus("transcribing");

    try {
      const transcript = await onTranscribe?.(blob);
      if (!transcript?.trim()) throw new Error("empty transcript");
      setDraft(transcript);
      setMode("text");
      setVoiceError("");
      setComposerStatus("draft");
    } catch {
      setMode("text");
      setComposerStatus("error");
      setVoiceError("Не вдалося розпізнати запис. Напиши думки текстом.");
    }
  }, [onTranscribe]);

  const recorder = useVoiceRecorder({ onComplete: completeRecording });

  useEffect(() => {
    if (!["permission", "unsupported", "error"].includes(recorder.status)) return;

    setMode("text");
    setComposerStatus("error");
    setVoiceError(recorder.error);
  }, [recorder.error, recorder.status]);

  const localStatus = composerStatus;
  const status = externalStatus ?? localStatus;
  const statusLabel = {
    idle: "Готовий до запису",
    listening: "Слухаю",
    transcribing: "Розпізнаю запис",
    draft: "Чернетка готова",
    submitting: "Надсилаю думку",
    responding: "Готую відповідь",
    error: "Потрібна твоя увага",
  }[status] ?? status;

  const toggleRecording = async () => {
    if (disabled || recorder.isStarting) return;

    if (recorder.isRecording) {
      setComposerStatus("transcribing");
      recorder.stop();
      return;
    }

    setVoiceError("");
    setComposerStatus("listening");
    await recorder.start();
  };

  const submit = () => {
    if (disabled || !draft.trim() || status === "submitting") return;
    onSubmit(draft);
  };

  return (
    <section className="voice-text-composer" aria-label="Голосове або текстове введення">
      <div className={`voice-text-composer__ai-surface${mode === "voice" ? " voice-text-composer__ai-surface--hero" : ""}`}>
        <div className={`voice-composer__orb is-${status}${mode === "voice" ? " voice-composer__orb--hero" : ""}`} data-testid="ai-orb" aria-hidden="true" />
        <div className="voice-text-composer__ai-copy">
          <p className="voice-text-composer__status" role="status" aria-live="polite">Статус: {statusLabel}</p>
          {responseText ? <p className="voice-text-composer__response">{responseText}</p> : null}
          {responseText && onSpeak ? (
            <button className="voice-text-composer__speak" type="button" onClick={() => onSpeak(responseText)}>
              Прослухати відповідь
            </button>
          ) : null}
        </div>
      </div>

      {voiceError ? <p role="alert">{voiceError}</p> : null}

      {mode === "voice" ? (
        <div className="voice-text-composer__voice-mode">
          <p className="voice-text-composer__mode-label">Голосовий режим</p>
          <button className="voice-text-composer__microphone" type="button" onClick={toggleRecording} disabled={disabled || recorder.isStarting}>
            {recorder.isRecording ? "Завершити запис" : "Почати запис"}
          </button>
          <button className="voice-text-composer__mode-switch" type="button" onClick={() => setMode("text")} disabled={disabled || recorder.isStarting}>
            Увімкнути текстовий режим
          </button>
        </div>
      ) : (
        <div className="voice-text-composer__text-mode">
          <label className="voice-text-composer__label" htmlFor="voice-text-composer-draft">Твоя думка</label>
          <textarea
            className="voice-text-composer__draft"
            id="voice-text-composer-draft"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (composerStatus === "error") {
                setVoiceError("");
                setComposerStatus("draft");
              }
            }}
            disabled={disabled}
          />
          <button className="voice-text-composer__submit" type="button" onClick={submit} disabled={disabled || !draft.trim() || status === "submitting"}>
            {status === "submitting" ? <CircleNotch className="spin" size={20} aria-hidden /> : null}
            <span>{submitLabel}</span>
          </button>
          <button className="voice-text-composer__mode-switch" type="button" onClick={() => setMode("voice")} disabled={disabled}>
            Увімкнути голосовий режим
          </button>
        </div>
      )}
    </section>
  );
}
