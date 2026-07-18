import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Flag,
  Folder,
  GoogleLogo,
  Lightbulb,
  ListChecks,
  Microphone,
  ScribbleLoop,
  Clock,
  Waveform,
} from "@phosphor-icons/react";
import { Button } from "../../components/Button";

export const ENTRY_SLIDES = [
  {
    id: "chaos",
    eyebrow: "AI-планер, що розкладає думки по місцях",
    title: "Вислови все, що в голові. Отримай реалістичний план.",
    titleLines: ["Вислови все,", "що в голові.", "Отримай", "реалістичний план."],
    text: "Вектор структурує думки, врахує твій календар і покаже наступний крок без зайвого тиску.",
  },
  {
    id: "voice",
    eyebrow: "Твій спокійний AI-планер",
    title: "Не тримай усе в голові.",
    text: "Скажи як є — Вектор складе план з урахуванням календаря, енергії та головної мети.",
  },
  {
    id: "path",
    eyebrow: "AI-планер для ясності й фокусу",
    title: "Побач шлях від думки до мети.",
    text: "Диктуй усе, що турбує. Вектор відокремить ідеї від задач і підкаже найважливіше.",
  },
];

function ChaosVisual() {
  const thoughts = ["перший випуск", "написати Марії", "замовити корм"];
  const plan = [["09:30", "Структура епізоду"], ["11:00", "Командний синк"], ["12:00", "Лист Марії"]];
  return (
    <div className="chaos-visual" aria-label="Хаотичні думки перетворюються на план">
      <div className="visual-head"><span><ScribbleLoop size={19} />У голові</span><ArrowRight size={20} /><span><ListChecks size={19} />У плані</span></div>
      <div className="visual-columns">
        <div>{thoughts.map((thought) => <span key={thought}><ScribbleLoop size={15} />{thought}</span>)}</div>
        <div>{plan.map(([time, label]) => <span key={time}><Clock size={15} /><b>{time}</b>{label}</span>)}</div>
      </div>
    </div>
  );
}

function VoiceVisual() {
  return (
    <div className="voice-visual">
      <span className="voice-orb"><Microphone size={34} weight="duotone" /></span>
      <Waveform size={96} color="var(--brand-primary)" aria-hidden />
      <blockquote>«Треба підготувати перший випуск і написати Марії…»</blockquote>
      <span className="voice-result"><CheckCircle size={18} weight="fill" />Знайдено 2 задачі · план готовий</span>
    </div>
  );
}

function PathVisual() {
  const nodes = [[Lightbulb, "Думки"], [Folder, "Пілотний епізод"], [ListChecks, "Наступна задача"], [Flag, "Мета"]];
  return (
    <div className="path-visual">
      <div className="path-row">
        {nodes.map(([Icon, label], index) => (
          <div className="path-segment" key={label}>
            <span className={`path-node path-node--${index}`}><Icon size={22} weight="duotone" /></span>
            <small>{label}</small>
            {index < nodes.length - 1 ? <ArrowRight className="path-arrow" size={15} aria-hidden /> : null}
          </div>
        ))}
      </div>
      <div className="recommended-step"><CheckCircle size={21} weight="duotone" /><span><small>Рекомендований крок</small><strong>Підготувати структуру епізоду · 60 хв</strong></span></div>
    </div>
  );
}

export function EntryCarousel({ autoAdvanceMs = 6000, reducedMotion = false, initialIndex = 0, onContinue = () => {} }) {
  const [index, setIndex] = useState(initialIndex);
  const [interacted, setInteracted] = useState(false);
  const touchStart = useRef(null);

  useEffect(() => {
    if (reducedMotion || interacted) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % ENTRY_SLIDES.length), autoAdvanceMs);
    return () => window.clearInterval(timer);
  }, [autoAdvanceMs, interacted, reducedMotion]);

  const go = (next) => {
    setInteracted(true);
    setIndex((next + ENTRY_SLIDES.length) % ENTRY_SLIDES.length);
  };
  const slide = ENTRY_SLIDES[index];

  return (
    <section
      className="entry-screen"
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; setInteracted(true); }}
      onTouchEnd={(event) => {
        const delta = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(delta) > 42) go(index + (delta < 0 ? 1 : -1));
      }}
    >
      <img className="vector-wordmark" src="/assets/vector-wordmark.png" alt="Вектор" />
      <div className="entry-copy">
        <p className="entry-eyebrow">{slide.eyebrow}</p>
        <h1 aria-label={slide.title}>{slide.titleLines ? slide.titleLines.map((line) => <React.Fragment key={line}>{line}<br /></React.Fragment>) : slide.title}</h1>
        <p className="entry-description">{slide.text}</p>
      </div>
      <div className="entry-visual">
        {slide.id === "chaos" ? <ChaosVisual /> : slide.id === "voice" ? <VoiceVisual /> : <PathVisual />}
      </div>
      <div className="entry-controls">
        <button aria-label="Попередній слайд" onClick={() => go(index - 1)}><ArrowLeft size={19} /></button>
        <div className="entry-dots" aria-label={`Слайд ${index + 1} з 3`}>
          {ENTRY_SLIDES.map((item, itemIndex) => <span key={item.id} className={itemIndex === index ? "is-active" : ""} />)}
        </div>
        <button aria-label="Наступний слайд" onClick={() => go(index + 1)}><ArrowRight size={19} /></button>
      </div>
      <div className="entry-action">
        <Button icon={GoogleLogo} onClick={onContinue}>Продовжити з Google</Button>
        <small>Доступ до календаря потрібен лише для вільних слотів</small>
      </div>
    </section>
  );
}
