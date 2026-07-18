import { CalendarCheck, Check, CircleNotch, ListChecks, Sparkle } from "@phosphor-icons/react";

const steps = [
  ["Розпізнаю думки", Check],
  ["Знаходжу задачі", Check],
  ["Перевіряю календар", CalendarCheck],
  ["Складаю план", CircleNotch],
];

export function AIProcessing() {
  return (
    <section className="ai-processing">
      <span className="ai-processing__icon"><Sparkle size={34} weight="duotone" /></span>
      <h1>Звільняю місце в голові</h1>
      <p>Думки вже збережені. Зараз Вектор обережно збирає реалістичний план.</p>
      <div className="processing-steps">{steps.map(([label,Icon],index) => <div className={index < 2 ? "is-done" : index === 2 ? "is-active" : ""} key={label}><span><Icon className={index === 3 ? "spin" : ""} size={18} /></span><strong>{label}</strong></div>)}</div>
      <div className="processing-hint"><ListChecks size={18} />Ідеї залишаться в backlog, доки ти не захочеш розбити їх на задачі.</div>
    </section>
  );
}
