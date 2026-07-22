import { useState } from "react";
import { MagnifyingGlass, SlidersHorizontal, WarningCircle } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { EntityCard } from "../../components/EntityCard";
import { SegmentedControl } from "../../components/SegmentedControl";
import { StateView } from "../../components/StateView";
import { TaskCard } from "../../components/TaskCard";
import { DEMO_TASKS } from "../../data/demoData";
import { usePrototype } from "../../state/prototypeState";

export function InboxScreens({ screenId = "inbox-default", onNavigate = () => {} }) {
  const { state, updateState } = usePrototype();
  const [activeTab, setActiveTab] = useState(screenId === "inbox-ideas" || screenId === "inbox-search" ? "ideas" : screenId === "inbox-drafts" ? "drafts" : "tasks");
  const ideas = state.inboxIdeas;
  const drafts = state.inboxDrafts;
  const selectedItems = activeTab === "ideas" ? ideas : activeTab === "drafts" ? drafts : DEMO_TASKS;
  const selectDraft = (draft) => {
    updateState({ activeDraftId: draft.id });
    onNavigate("draft-plan-review");
  };
  if (screenId === "inbox-failed-draft") return <AppFrame title="Чернетка" onBack={() => onNavigate("inbox-default")} activeRoute="inbox-default" onNavigate={onNavigate}><StateView state="error" title="Думки збережено" message="AI не зміг завершити обробку, але твій Brain Dump не втрачено." action={<Button onClick={() => onNavigate("capture-processing")}>Повторити обробку</Button>} /><div className="draft-preview"><WarningCircle size={20} /><p>Мені треба підготувати перший випуск подкасту, написати Марії…</p></div></AppFrame>;
  return (
    <AppFrame title="Inbox" eyebrow="7 елементів" activeRoute="inbox-default" onNavigate={onNavigate} avatar>
      <div className="inbox-tools"><label><MagnifyingGlass size={18} /><input aria-label="Пошук" placeholder="Знайти задачу або ідею" /></label><button aria-label="Фільтри"><SlidersHorizontal size={20} /></button></div>
      <SegmentedControl items={[{ value: "tasks", label: "Задачі" }, { value: "ideas", label: "Ідеї" }, { value: "drafts", label: "Чернетки" }]} value={activeTab} onChange={setActiveTab} />
      {selectedItems.length === 0 ? <StateView state="empty" title={activeTab === "ideas" ? "Ідей ще немає" : activeTab === "drafts" ? "Чернеток ще немає" : "Inbox порожній"} message={activeTab === "drafts" ? "Збережені Brain Dump з’являться тут." : "Зроби Brain Dump — нові елементи з’являться тут."} action={<Button onClick={() => onNavigate("capture-chooser")}>Зробити Brain Dump</Button>} /> : <div className="inbox-section"><div className="section-row"><h2>{activeTab === "ideas" ? "Ідеї" : activeTab === "drafts" ? "Чернетки" : "Задачі"}</h2><span>{selectedItems.length}</span></div>{activeTab === "ideas" ? ideas.map((idea) => <EntityCard key={idea.id} label="Ідея" title={idea.title} meta={idea.alignment ? `${idea.alignment}% відповідності меті` : "Збережено в ідеях"} tone="idea" onClick={() => onNavigate("idea-detail")} />) : activeTab === "drafts" ? drafts.map((draft) => <article className="entity-card entity-card--brand" key={draft.id}><span className="entity-card__label">Brain Dump</span><strong>{draft.text}</strong><span className="entity-card__meta">{draft.status === "needs_clarification" ? "Потрібне уточнення" : "Збережено як чернетку"}</span><Button variant="secondary" onClick={() => selectDraft(draft)}>Розібрати з AI</Button></article>) : DEMO_TASKS.map((task) => <TaskCard key={task.id} task={task} onClick={() => onNavigate("task-detail")} />)}</div>}
    </AppFrame>
  );
}
