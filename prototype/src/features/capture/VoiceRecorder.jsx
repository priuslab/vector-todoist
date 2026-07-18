import { Microphone, Stop, X } from "@phosphor-icons/react";
import { Button } from "../../components/Button";

export function VoiceRecorder({ transcript, onCancel, onFinish }) {
  const levels = [18,30,22,42,55,34,68,44,28,52,65,40,22,48,58,36,26,44,30,18];
  return (
    <section className="recorder">
      <div className="recorder__status"><span className="record-dot" />Записую · 00:23</div>
      <span className="recorder__mic"><Microphone size={40} weight="duotone" /></span>
      <div className="waveform" aria-label="Рівень звуку">{levels.map((height,index) => <span key={index} style={{ height }} />)}</div>
      <p>{transcript}</p>
      <div className="recorder__actions"><button aria-label="Скасувати запис" onClick={onCancel}><X size={20} /></button><Button icon={Stop} onClick={onFinish}>Завершити запис</Button></div>
    </section>
  );
}
