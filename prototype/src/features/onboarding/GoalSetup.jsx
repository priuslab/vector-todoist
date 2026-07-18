import { Compass, MagicWand, PencilSimple, WarningCircle } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { DEMO_GOAL } from "../../data/demoData";

export function GoalSetup({ screenId, onBack, onNext, onRoute }) {
  const footerByScreen = {
    "goal-manual": <Button onClick={onNext}>Зберегти мету</Button>,
    "goal-test-start": <Button onClick={() => onRoute("goal-test-result")}>Почати короткий діалог</Button>,
    "goal-test-result": <><Button onClick={onNext}>Підтвердити мету</Button><button className="text-action">Відредагувати</button></>,
    "goal-skip-warning": <><Button onClick={onNext}>Все одно продовжити</Button><button className="text-action" onClick={() => onRoute("goal-choice")}>Повернутися до вибору</button></>,
  };
  const centered = ["goal-test-start", "goal-test-result", "goal-skip-warning"].includes(screenId);
  const twoRows = ["goal-test-result", "goal-skip-warning"].includes(screenId);
  const footer = footerByScreen[screenId];

  return (
    <AppFrame
      title="Головна мета"
      eyebrow="Крок 3 з 4"
      onBack={onBack}
      noNav
      footer={footer}
      footerRows={twoRows ? 2 : 1}
      contentAlign={centered ? "center" : "start"}
    >
      {screenId === "goal-choice" ? <><div className="section-heading"><h1>Що для тебе зараз найважливіше?</h1><p>Одна мета безкоштовна. Вона допомагає Oracle відрізняти важливе від шуму.</p></div><div className="choice-list"><button onClick={() => onRoute("goal-manual")}><PencilSimple size={23} /><span><strong>Ввести вручну</strong><small>Я вже знаю, чого хочу</small></span></button><button onClick={() => onRoute("goal-test-start")}><MagicWand size={23} /><span><strong>Визначити з AI</strong><small>Короткий діалог без тиску</small></span></button><button onClick={() => onRoute("goal-skip-warning")}><Compass size={23} /><span><strong>Продовжити без мети</strong><small>Працюватиме як розумний to-do</small></span></button></div></> : null}
      {screenId === "goal-manual" ? <><div className="section-heading"><h1>Сформулюй свою мету</h1><p>Можна неідеально — Вектор допоможе зробити її конкретнішою.</p></div><div className="form-stack"><label>Головна мета<textarea defaultValue={DEMO_GOAL.title} /></label><label>Чому це важливо?<textarea defaultValue="Хочу створити корисний проєкт і перевірити формат" /></label><label>Строк<input value="30 вересня" readOnly /></label></div></> : null}
      {screenId === "goal-test-start" ? <><div className="onboarding-hero"><span><MagicWand size={34} weight="duotone" /></span><h1>Знайдемо одну опорну мету</h1><p>AI поставить кілька коротких запитань про твої пріоритети. Остаточний протокол буде підключено окремо.</p></div><div className="conversation-preview"><span>Що зараз забирає найбільше твоєї уваги?</span><span>Який результат дав би відчуття руху вперед?</span></div></> : null}
      {screenId === "goal-test-result" ? <><div className="section-heading"><span className="success-chip">Рекомендація AI</span><h1>Твоя опорна мета</h1><p>Вона достатньо конкретна, вимірювана й відповідає тому, що зараз важливо.</p></div><div className="goal-result"><strong>{DEMO_GOAL.title}</strong><span>Висока відповідність · 92%</span></div></> : null}
      {screenId === "goal-skip-warning" ? <div className="onboarding-hero onboarding-hero--warning"><span><WarningCircle size={34} weight="duotone" /></span><h1>Можна продовжити без мети</h1><p>Задачі, календар і нагадування працюватимуть. Але Oracle не зможе показати найкоротший шлях і відповідність ідей.</p></div> : null}
    </AppFrame>
  );
}
