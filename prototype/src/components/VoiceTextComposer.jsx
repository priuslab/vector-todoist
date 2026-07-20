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
    <section aria-label="Голосове або текстове введення">
      <p aria-live="polite">Статус: {status}</p>

      {mode === "voice" ? (
        <div>
          <p>Голосовий режим</p>
          <button type="button" onClick={() => setMode("text")}>
            Увімкнути текстовий режим
          </button>
        </div>
      ) : (
        <div>
          <label htmlFor="voice-text-composer-draft">Твоя думка</label>
          <textarea
            id="voice-text-composer-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="button" onClick={submit}>Відправити</button>
          <button type="button" onClick={() => setMode("voice")}>
            Увімкнути голосовий режим
          </button>
        </div>
      )}
    </section>
  );
}
