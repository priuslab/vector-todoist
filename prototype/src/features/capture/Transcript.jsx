import { Microphone } from "@phosphor-icons/react";
import { DEMO_BRAIN_DUMP } from "../../data/demoData";

export function Transcript({ editable = false, value, onChange }) {
  return (
    <section className="transcript-card">
      <header><span><Microphone size={17} />Транскрипт</span><small>00:23</small></header>
      {editable ? <textarea value={value ?? DEMO_BRAIN_DUMP} onChange={(event) => onChange?.(event.target.value)} aria-label="Редагувати транскрипт" /> : <p>{value ?? DEMO_BRAIN_DUMP}</p>}
    </section>
  );
}
