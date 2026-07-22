import { Microphone, Sparkle } from "@phosphor-icons/react";
import { Button } from "../../components/Button";
import { VoiceTextComposer } from "../../components/VoiceTextComposer";
import { useState } from "react";

const questions = {
  1: { text: "Коли має бути готова структура першого епізоду?", replies: ["До четверга", "До кінця тижня", "Без дедлайну"] },
  2: { text: "Лист Марії важливо надіслати до синку чи після?", replies: ["До синку", "Після синку"] },
};

export function Clarification({ number = 1, onAnswer, onTranscribe, questions: liveQuestions, deferSubmit = false }) {
  const isLiveQuestion = Boolean(liveQuestions?.[0]);
  const item = isLiveQuestion ? { text: liveQuestions[0].text } : questions[number];
  const [selected, setSelected] = useState("");
  const [answerMode, setAnswerMode] = useState(null);
  return (
    <section className="clarification">
      <span className="clarification__badge"><Sparkle size={17} weight="fill" />Уточнення {number} з {liveQuestions?.length || 2}</span>
      <h1>{item.text}</h1>
      <p>Це впливає на розклад, тому краще уточнити. Решту Вектор визначить сам.</p>
      {answerMode ? (
        <div className="clarification__voice-answer">
          <VoiceTextComposer
            key={answerMode}
            initialMode={answerMode}
            onTranscribe={onTranscribe}
            onSubmit={onAnswer}
            submitLabel="Продовжити"
          />
          <button className="text-action" type="button" onClick={() => setAnswerMode(null)}>Повернутися до способів відповіді</button>
        </div>
      ) : isLiveQuestion ? (
        <div className="clarification__actions">
          <Button variant="secondary" icon={Microphone} onClick={() => setAnswerMode("voice")}>Відповісти голосом</Button>
          <Button variant="tertiary" onClick={() => setAnswerMode("text")}>Написати відповідь</Button>
        </div>
      ) : (
        <>
          <div className="quick-replies">{item.replies.map((reply) => <button aria-pressed={selected === reply} className={selected === reply ? "is-selected" : ""} key={reply} type="button" onClick={() => deferSubmit ? setSelected(reply) : onAnswer(reply)}>{reply}</button>)}</div>
          <div className="clarification__actions">
            {onTranscribe ? <Button variant="secondary" icon={Microphone} onClick={() => setAnswerMode("voice")}>Відповісти голосом</Button> : null}
            <button className="button button--primary" type="button" disabled={!selected} onClick={() => onAnswer?.(selected)}>Продовжити</button>
          </div>
        </>
      )}
    </section>
  );
}
