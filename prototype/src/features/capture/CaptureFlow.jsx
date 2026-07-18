import { useEffect, useState } from "react";
import { Keyboard, Microphone } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { StateView } from "../../components/StateView";
import { DEMO_BRAIN_DUMP } from "../../data/demoData";
import { AIProcessing } from "./AIProcessing";
import { AIResult } from "./AIResult";
import { Clarification } from "./Clarification";
import { Transcript } from "./Transcript";
import { VoiceRecorder } from "./VoiceRecorder";

export function CaptureFlow({ screenId = "capture-chooser", onBack, onNavigate = () => {}, processingDelayMs = 1400 }) {
  const initial = screenId.replace("capture-", "");
  const [stage, setStage] = useState(initial === "chooser" ? "chooser" : initial);

  useEffect(() => {
    if (stage !== "processing") return undefined;
    const timer = window.setTimeout(() => setStage("question-1"), processingDelayMs);
    return () => window.clearTimeout(timer);
  }, [processingDelayMs, stage]);

  const body = stage === "chooser" ? <section className="capture-chooser"><span className="capture-orb"><Microphone size={38} weight="duotone" /></span><h1>Що зараз у голові?</h1><p>Говори хаотично — не треба формулювати задачі чи оцінювати час.</p><div className="capture-options"><Button icon={Microphone} onClick={() => setStage("recording")}>Диктувати</Button><Button variant="secondary" icon={Keyboard} onClick={() => setStage("transcript")}>Написати текстом</Button></div></section>
    : stage === "recording" ? <VoiceRecorder transcript="Мені треба підготувати перший випуск…" onCancel={() => setStage("chooser")} onFinish={() => setStage("processing")} />
    : stage === "transcript" ? <section className="capture-transcript"><h1>Твої думки</h1><Transcript editable /><Button onClick={() => setStage("processing")}>Структурувати й запланувати</Button></section>
    : stage === "processing" ? <AIProcessing />
    : stage === "question-1" ? <Clarification number={1} onAnswer={() => setStage("question-2")} />
    : stage === "question-2" ? <Clarification number={2} onAnswer={() => setStage("result")} />
    : stage === "result" ? <AIResult onViewDay={() => onNavigate("today-normal")} onUndo={() => setStage("chooser")} />
    : stage === "review" ? <section className="capture-transcript"><h1>Перевір транскрипт</h1><p className="soft-copy">Аудіо було тихим у кількох місцях. Відредагуй текст або запиши ще раз.</p><Transcript editable /><Button onClick={() => setStage("processing")}>Повторити обробку</Button></section>
    : <StateView state="error" title="Не вдалося опрацювати" message={`Brain Dump збережено в Inbox: «${DEMO_BRAIN_DUMP.slice(0, 58)}…»`} action={<Button onClick={() => setStage("processing")}>Спробувати ще раз</Button>} />;

  return <AppFrame title="Brain Dump" eyebrow="AI-асистент" onBack={onBack} noNav>{body}</AppFrame>;
}
