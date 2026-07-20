import { useCallback, useEffect, useState } from "react";
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

export function VoiceTextComposer({ initialMode = "voice", onTranscribe, onSubmit, onSpeak }) {
  const [mode, setMode] = useState(initialMode === "text" ? "text" : "voice");
  const [draft, setDraft] = useState("");
  const [composerStatus, setComposerStatus] = useState(initialMode === "text" ? "draft" : "idle");
  const [voiceError, setVoiceError] = useState("");

  const completeRecording = useCallback(async (blob) => {
    setComposerStatus("transcribing");

    try {
      const transcript = await onTranscribe?.(blob);
      setDraft(transcript ?? "");
      setMode("text");
      setComposerStatus("draft");
    } catch {
      setMode("text");
      setComposerStatus("draft");
      setVoiceError("Не вдалося розпізнати запис. Напиши думки текстом.");
    }
  }, [onTranscribe]);

  const recorder = useVoiceRecorder({ onComplete: completeRecording });

  useEffect(() => {
    if (!["permission", "unsupported", "error"].includes(recorder.status)) return;

    setMode("text");
    setComposerStatus("draft");
    setVoiceError(recorder.error);
  }, [recorder.error, recorder.status]);

  const status = mode === "text" ? "draft" : composerStatus;
  const statusLabel = {
    idle: "Готовий до запису",
    listening: "Слухаю",
    transcribing: "Розпізнаю запис",
    draft: "Чернетка готова",
  }[status] ?? status;

  const toggleRecording = async () => {
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
    if (!draft.trim()) return;
    onSubmit(draft);
  };

  return (
    <section className="voice-text-composer" aria-label="Голосове або текстове введення">
      <p className="voice-text-composer__status" role="status" aria-live="polite">Статус: {statusLabel}</p>

      {voiceError ? <p role="alert">{voiceError}</p> : null}

      {mode === "voice" ? (
        <div className="voice-text-composer__voice-mode">
          <p>Голосовий режим</p>
          <button className="voice-text-composer__microphone" type="button" onClick={toggleRecording}>
            {recorder.isRecording ? "Завершити запис" : "Почати запис"}
          </button>
          <button className="voice-text-composer__mode-switch" type="button" onClick={() => setMode("text")}>
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
            onChange={(event) => setDraft(event.target.value)}
          />
          <button className="voice-text-composer__submit" type="button" onClick={submit}>Відправити</button>
          <button className="voice-text-composer__mode-switch" type="button" onClick={() => setMode("voice")}>
            Увімкнути голосовий режим
          </button>
        </div>
      )}
    </section>
  );
}
