import { Microphone, Sparkle } from "@phosphor-icons/react";
import { Button } from "../../components/Button";

const questions = {
  1: { text: "Коли має бути готова структура першого епізоду?", replies: ["До четверга", "До кінця тижня", "Без дедлайну"] },
  2: { text: "Лист Марії важливо надіслати до синку чи після?", replies: ["До синку", "Після синку"] },
};

export function Clarification({ number = 1, onAnswer }) {
  const item = questions[number];
  return (
    <section className="clarification">
      <span className="clarification__badge"><Sparkle size={17} weight="fill" />Уточнення {number} з 2</span>
      <h1>{item.text}</h1>
      <p>Це впливає на розклад, тому краще уточнити. Решту Вектор визначить сам.</p>
      <div className="quick-replies">{item.replies.map((reply) => <button key={reply} onClick={() => onAnswer(reply)}>{reply}</button>)}</div>
      <Button variant="secondary" icon={Microphone}>Відповісти голосом</Button>
    </section>
  );
}
