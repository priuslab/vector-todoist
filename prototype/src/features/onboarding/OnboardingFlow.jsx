import { useState } from "react";
import { Bell, CalendarBlank, Clock, Lightning, Moon, Timer } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { SegmentedControl } from "../../components/SegmentedControl";

const content = {
  "onboarding-welcome": { icon: CalendarBlank, title: "Налаштуй Вектор під свій ритм", text: "Три короткі кроки — календар, енергія та головна мета. Усе можна змінити пізніше." },
  "calendar-permission": { icon: CalendarBlank, title: "План без конфліктів", text: "Вектор бачить зайняті слоти Google Calendar і ставить задачі лише у вільний час." },
  "work-rhythm": { icon: Clock, title: "Коли ти зазвичай працюєш?", text: "Це межі для автоматичного плану, а не жорсткі правила." },
  "quiet-hours": { icon: Moon, title: "Коли тебе не турбувати?", text: "Telegram не надсилатиме нагадування у тихі години." },
  "energy-peak": { icon: Lightning, title: "Коли найбільше енергії?", text: "Складні задачі потраплятимуть у твій найкращий час." },
  "focus-settings": { icon: Timer, title: "Який темп зручний?", text: "Початкові значення адаптуються після виконаних і перенесених задач." },
};

export function OnboardingFlow({ screenId, onBack, onNext, onCalendarConnect = onNext, onCalendarSkip = onNext }) {
  const [days, setDays] = useState("Будні");
  const [energy, setEnergy] = useState("Ранок");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [quietStart, setQuietStart] = useState("21:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [focusBlock, setFocusBlock] = useState("50");
  const [breakMinutes, setBreakMinutes] = useState("10");
  const [dailyLimit, setDailyLimit] = useState("6");
  const item = content[screenId] ?? content["onboarding-welcome"];
  const Icon = item.icon;
  const calendar = screenId === "calendar-permission";
  const footer = (
    <>
      <Button onClick={calendar ? onCalendarConnect : onNext}>{calendar ? "Надати доступ" : "Продовжити"}</Button>
      <button className="text-action" onClick={calendar ? onCalendarSkip : onNext}>{calendar ? "Пропустити" : "Налаштувати пізніше"}</button>
    </>
  );
  const centered = ["onboarding-welcome", "calendar-permission"].includes(screenId);

  return (
    <AppFrame
      title="Коротке налаштування"
      eyebrow="Онбординг"
      onBack={onBack}
      noNav
      footer={footer}
      footerRows={2}
    >
      <div className="onboarding-screen-body">
        <div className="onboarding-progress"><span className="is-active" /><span /><span /><span /></div>
        <div className={`onboarding-main ${centered ? "onboarding-main--center" : "onboarding-main--form"}`}>
          <section className="onboarding-hero">
            <span><Icon size={34} weight="duotone" /></span>
            <h1>{item.title}</h1>
            <p>{item.text}</p>
            {calendar ? <p className="onboarding-note">Без доступу Вектор не бачитиме зайняті слоти й може запропонувати час із конфліктом.</p> : null}
          </section>
          {screenId === "work-rhythm" ? (
            <div className="form-stack">
              <SegmentedControl
                items={[{ value: "Будні", label: "Пн–Пт" }, { value: "Щодня", label: "Щодня" }, { value: "Власні", label: "Власні" }]}
                value={days}
                onChange={setDays}
              />
              <label htmlFor="work-start">Початок<input id="work-start" type="time" value={workStart} onChange={(event) => setWorkStart(event.target.value)} /></label>
              <label htmlFor="work-end">Завершення<input id="work-end" type="time" value={workEnd} onChange={(event) => setWorkEnd(event.target.value)} /></label>
            </div>
          ) : null}
          {screenId === "quiet-hours" ? (
            <div className="form-stack">
              <div className="form-grid"><label htmlFor="quiet-start">Тиха година початку<input id="quiet-start" type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} /></label><label htmlFor="quiet-end">Тиха година завершення<input id="quiet-end" type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} /></label></div>
              <label className="switch-row"><span><Bell size={20} />Ранковий план</span><input type="checkbox" defaultChecked /></label>
              <label className="switch-row"><span><Bell size={20} />Вечірній підсумок</span><input type="checkbox" defaultChecked /></label>
            </div>
          ) : null}
          {screenId === "energy-peak" ? (
            <div className="form-stack">
              <SegmentedControl
                items={[{ value: "Ранок", label: "Ранок" }, { value: "День", label: "День" }, { value: "Вечір", label: "Вечір" }]}
                value={energy}
                onChange={setEnergy}
              />
              <div className="energy-card"><strong>Твій пік</strong><span>09:30–12:30</span><small>Deep Work плануватиметься тут</small></div>
            </div>
          ) : null}
          {screenId === "focus-settings" ? (
            <div className="form-stack">
              <label htmlFor="focus-block">Фокус-блок<select id="focus-block" value={focusBlock} onChange={(event) => setFocusBlock(event.target.value)}>{[25, 50, 60, 90].map((value) => <option key={value} value={value}>{value} хв</option>)}</select></label>
              <label htmlFor="break-minutes">Перерва<select id="break-minutes" value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)}>{[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value} хв</option>)}</select></label>
              <label htmlFor="daily-limit">Денний ліміт<select id="daily-limit" value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)}>{[3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value} год</option>)}</select></label>
            </div>
          ) : null}
        </div>
      </div>
    </AppFrame>
  );
}
