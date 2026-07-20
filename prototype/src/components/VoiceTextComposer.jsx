import { useState } from "react";

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

  const status = mode === "text" ? "draft" : "idle";

  const submit = () => {
    if (!draft.trim()) return;
    onSubmit(draft);
  };

  return (
    <section className="voice-text-composer" aria-label="Голосове або текстове введення">
      <p className="voice-text-composer__status" aria-live="polite">Статус: {status}</p>

      {mode === "voice" ? (
        <div className="voice-text-composer__voice-mode">
          <p>Голосовий режим</p>
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
