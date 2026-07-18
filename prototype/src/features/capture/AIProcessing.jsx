import { Check, CircleNotch, ListChecks, Sparkle } from "@phosphor-icons/react";
import { Button } from "../../components/Button";

const steps = [
  ["Розпізнаю думки", Check],
  ["Знаходжу задачі та ідеї", Check],
  ["Перевіряю впевненість", CircleNotch],
  ["Готую пропозиції", CircleNotch],
];

export function AIProcessing({ error, onRetry }) {
  return (
    <section className="ai-processing">
      <span className="ai-processing__icon"><Sparkle size={34} weight="duotone" /></span>
      <h1>Звільняю місце в голові</h1>
      <p>Думки вже збережені. Зараз Вектор обережно структурує їх і готує пропозиції.</p>
      <div className="processing-steps">{steps.map(([label,Icon],index) => <div className={index < 2 ? "is-done" : index === 2 ? "is-active" : ""} key={label}><span><Icon className={index === 3 ? "spin" : ""} size={18} /></span><strong>{label}</strong></div>)}</div>
      {error ? <><p role="alert" className="soft-copy">{error}</p>{onRetry ? <Button onClick={onRetry}>Спробувати ще раз</Button> : null}</> : <div className="processing-hint"><ListChecks size={18} />Ідеї залишаться в backlog, доки ти не захочеш розбити їх на задачі.</div>}
    </section>
  );
}
