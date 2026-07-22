import { useEffect, useState } from "react";
import { Bell, CalendarBlank, Clock, Lightning, Moon, Timer } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { SegmentedControl } from "../../components/SegmentedControl";
import { TimePicker } from "../../components/TimePicker";

const content = {
  "onboarding-welcome": { icon: CalendarBlank, title: "Налаштуй Вектор під свій ритм", text: "Три короткі кроки — календар, енергія та головна мета. Усе можна змінити пізніше." },
  "calendar-permission": { icon: CalendarBlank, title: "План без конфліктів", text: "Вектор бачить зайняті слоти Google Calendar і ставить задачі лише у вільний час." },
  "work-rhythm": { icon: Clock, title: "Коли ти зазвичай працюєш?", text: "Це межі для автоматичного плану, а не жорсткі правила." },
  "quiet-hours": { icon: Moon, title: "Коли тебе не турбувати?", text: "Telegram не надсилатиме нагадування у тихі години." },
  "energy-peak": { icon: Lightning, title: "Коли найбільше енергії?", text: "Складні задачі потраплятимуть у твій найкращий час." },
  "focus-settings": { icon: Timer, title: "Який темп зручний?", text: "Початкові значення адаптуються після виконаних і перенесених задач." },
};

const progressByScreen = {
  "onboarding-welcome": 1,
  "calendar-permission": 1,
  "work-rhythm": 2,
  "quiet-hours": 2,
  "energy-peak": 3,
  "focus-settings": 3,
};

const energyWindows = {
  "Ранок": { range: "09:30–12:30", description: "Ранковий deep work плануватиметься тут" },
  "День": { range: "12:30–15:30", description: "Денний deep work плануватиметься тут" },
  "Вечір": { range: "17:00–20:00", description: "Вечірній фокус плануватиметься тут" },
};

const ONBOARDING_PREFERENCES_KEY = "vector:onboarding-preferences";

function readOnboardingPreferences() {
  try {
    return JSON.parse(window.localStorage.getItem(ONBOARDING_PREFERENCES_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function OnboardingFlow({ screenId, onBack, onNext, onCalendarConnect = onNext, onCalendarSkip = onNext }) {
  const [preferences] = useState(readOnboardingPreferences);
  const [days, setDays] = useState(preferences.days === "Щодня" ? "Щодня" : "Будні");
  const [energy, setEnergy] = useState(preferences.energy ?? "Ранок");
  const [workStart, setWorkStart] = useState(preferences.workStart ?? "09:00");
  const [workEnd, setWorkEnd] = useState(preferences.workEnd ?? "18:00");
  const [quietStart, setQuietStart] = useState(preferences.quietStart ?? "21:00");
  const [quietEnd, setQuietEnd] = useState(preferences.quietEnd ?? "08:00");
  const [focusBlock, setFocusBlock] = useState(preferences.focusBlock ?? "50");
  const [breakMinutes, setBreakMinutes] = useState(preferences.breakMinutes ?? "10");
  const [dailyLimit, setDailyLimit] = useState(preferences.dailyLimit ?? "6");
  const item = content[screenId] ?? content["onboarding-welcome"];
  const activeProgress = progressByScreen[screenId] ?? 1;
  const energyWindow = energyWindows[energy];
  const Icon = item.icon;
  const calendar = screenId === "calendar-permission";
  useEffect(() => {
    window.localStorage.setItem(ONBOARDING_PREFERENCES_KEY, JSON.stringify({ days, energy, workStart, workEnd, quietStart, quietEnd, focusBlock, breakMinutes, dailyLimit }));
  }, [days, energy, workStart, workEnd, quietStart, quietEnd, focusBlock, breakMinutes, dailyLimit]);
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
        <div className="onboarding-progress" aria-label={`Крок ${activeProgress} з 4`}>
          {[1, 2, 3, 4].map((step) => <span className={step <= activeProgress ? "is-active" : ""} key={step} />)}
        </div>
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
                items={[{ value: "Будні", label: "Пн–Пт" }, { value: "Щодня", label: "Щодня" }]}
                value={days}
                onChange={setDays}
              />
              <TimePicker label="Початок" value={workStart} onChange={setWorkStart} title="Вибери час початку" />
              <TimePicker label="Завершення" value={workEnd} onChange={setWorkEnd} title="Вибери час завершення" />
            </div>
          ) : null}
          {screenId === "quiet-hours" ? (
            <div className="form-stack">
              <div className="form-grid"><TimePicker label="Тиха година початку" value={quietStart} onChange={setQuietStart} title="Вибери початок тихих годин" /><TimePicker label="Тиха година завершення" value={quietEnd} onChange={setQuietEnd} title="Вибери завершення тихих годин" /></div>
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
              <div className="energy-card"><strong>Твій пік</strong><span>{energyWindow.range}</span><small>{energyWindow.description}</small></div>
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
