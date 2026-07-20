import { Microphone, Sparkle } from "@phosphor-icons/react";
import { Button } from "../../components/Button";
import { VoiceTextComposer } from "../../components/VoiceTextComposer";
import { useState } from "react";

const questions = {
  1: { text: "Коли має бути готова структура першого епізоду?", replies: ["До четверга", "До кінця тижня", "Без дедлайну"] },
  2: { text: "Лист Марії важливо надіслати до синку чи після?", replies: ["До синку", "Після синку"] },
};

export function Clarification({ number = 1, onAnswer, onTranscribe, questions: liveQuestions, deferSubmit = false }) {
  const item = liveQuestions?.[0] ? { text: liveQuestions[0].text, replies: ["Так", "Ні"] } : questions[number];
  const [selected, setSelected] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  return (
    <section className="clarification">
      <span className="clarification__badge"><Sparkle size={17} weight="fill" />Уточнення {number} з {liveQuestions?.length || 2}</span>
      <h1>{item.text}</h1>
      <p>Це впливає на розклад, тому краще уточнити. Решту Вектор визначить сам.</p>
      {voiceMode ? <div className="clarification__voice-answer"><VoiceTextComposer onTranscribe={onTranscribe} onSubmit={onAnswer} submitLabel="Продовжити" /><button className="text-action" type="button" onClick={() => setVoiceMode(false)}>Обрати коротку відповідь</button></div> : <><div className="quick-replies">{item.replies.map((reply) => <button className={selected === reply ? "is-selected" : ""} key={reply} onClick={() => deferSubmit ? setSelected(reply) : onAnswer(reply)}>{reply}</button>)}</div><div className="clarification__actions">
        {onTranscribe ? <Button variant="secondary" icon={Microphone} onClick={() => setVoiceMode(true)}>Відповісти голосом</Button> : null}
        <button className="button button--primary" type="button" disabled={!selected} onClick={() => onAnswer?.(selected)}>Продовжити</button>
      </div></>}
    </section>
  );
}
