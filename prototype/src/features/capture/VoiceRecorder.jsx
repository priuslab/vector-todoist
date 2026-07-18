import { Microphone, Pause, Play, Stop, X } from "@phosphor-icons/react";
import { Button } from "../../components/Button";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";

export function VoiceRecorder({ transcript, onCancel, onFinish, demo = false }) {
  const levels = [18,30,22,42,55,34,68,44,28,52,65,40,22,48,58,36,26,44,30,18];
  const recorder = useVoiceRecorder({ onComplete: onFinish });
  if (demo) return <section className="recorder"><div className="recorder__status"><span className="record-dot" />Записую · 00:23</div><span className="recorder__mic"><Microphone size={40} weight="duotone" /></span><div className="waveform" aria-label="Рівень звуку">{levels.map((height,index) => <span key={index} style={{ height }} />)}</div><p>{transcript}</p><div className="recorder__actions"><button aria-label="Скасувати запис" onClick={onCancel}><X size={20} /></button><Button icon={Stop} onClick={onFinish}>Завершити запис</Button></div></section>;
  if (recorder.status === "idle") {
    return <section className="recorder recorder--permission"><span className="recorder__mic"><Microphone size={40} weight="duotone" /></span><h1>Готовий записати твої думки</h1><p className="soft-copy">Говори вільно — Вектор збереже транскрипт для перевірки.</p>{recorder.error ? <p role="alert" className="soft-copy">{recorder.error}</p> : null}<Button onClick={recorder.start}>Почати запис</Button><button className="text-button" onClick={onCancel}>Написати текстом</button></section>;
  }
  if (recorder.status === "unsupported" || recorder.status === "permission") return <section className="recorder recorder--permission"><span className="recorder__mic"><Microphone size={40} weight="duotone" /></span><h1>Голосовий запис недоступний</h1><p role="alert" className="soft-copy">{recorder.error}</p><Button variant="secondary" onClick={onCancel}>Написати текстом</Button></section>;
  return (
    <section className="recorder">
      <div className="recorder__status"><span className="record-dot" />{recorder.status === "paused" ? "На паузі" : recorder.status === "uploading" ? "Завершую запис…" : "Записую"} · 00:23</div>
      <span className="recorder__mic"><Microphone size={40} weight="duotone" /></span>
      <div className="waveform" aria-label="Рівень звуку">{levels.map((height,index) => <span key={index} style={{ height }} />)}</div>
      <p>{transcript ?? "Твої слова з’являться після завершення запису."}</p>
      <div className="recorder__actions"><button aria-label="Скасувати запис" onClick={() => { recorder.cancel(); onCancel?.(); }}><X size={20} /></button><button aria-label={recorder.isPaused ? "Продовжити запис" : "Поставити на паузу"} onClick={recorder.pause}>{recorder.isPaused ? <Play size={20} /> : <Pause size={20} />}</button><Button icon={Stop} loading={recorder.status === "uploading"} onClick={recorder.stop}>Завершити запис</Button></div>
    </section>
  );
}
