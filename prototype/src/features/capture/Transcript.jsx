import { Microphone } from "@phosphor-icons/react";
import { DEMO_BRAIN_DUMP } from "../../data/demoData";

export function Transcript({ editable = false }) {
  return (
    <section className="transcript-card">
      <header><span><Microphone size={17} />Транскрипт</span><small>00:23</small></header>
      {editable ? <textarea defaultValue={DEMO_BRAIN_DUMP} aria-label="Редагувати транскрипт" /> : <p>{DEMO_BRAIN_DUMP}</p>}
    </section>
  );
}
