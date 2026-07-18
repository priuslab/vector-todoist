import { MagnifyingGlass, SlidersHorizontal, WarningCircle } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { EntityCard } from "../../components/EntityCard";
import { SegmentedControl } from "../../components/SegmentedControl";
import { StateView } from "../../components/StateView";
import { TaskCard } from "../../components/TaskCard";
import { DEMO_IDEAS, DEMO_TASKS } from "../../data/demoData";

export function InboxScreens({ screenId = "inbox-default", onNavigate = () => {} }) {
  if (screenId === "inbox-failed-draft") return <AppFrame title="Чернетка" onBack={() => onNavigate("inbox-default")} activeRoute="inbox-default" onNavigate={onNavigate}><StateView state="error" title="Думки збережено" message="AI не зміг завершити обробку, але твій Brain Dump не втрачено." action={<Button onClick={() => onNavigate("capture-processing")}>Повторити обробку</Button>} /><div className="draft-preview"><WarningCircle size={20} /><p>Мені треба підготувати перший випуск подкасту, написати Марії…</p></div></AppFrame>;
  return (
    <AppFrame title="Inbox" eyebrow="7 елементів" activeRoute="inbox-default" onNavigate={onNavigate} avatar>
      <div className="inbox-tools"><label><MagnifyingGlass size={18} /><input aria-label="Пошук" placeholder="Знайти задачу або ідею" /></label><button aria-label="Фільтри"><SlidersHorizontal size={20} /></button></div>
      <SegmentedControl items={[{value:"tasks",label:"Задачі"},{value:"ideas",label:"Ідеї"},{value:"drafts",label:"Чернетки"}]} value={screenId === "inbox-search" ? "ideas" : "tasks"} onChange={() => {}} />
      <div className="inbox-section"><div className="section-row"><h2>{screenId === "inbox-search" ? "Ідеї" : "Задачі"}</h2><span>{screenId === "inbox-search" ? 2 : 3}</span></div>{screenId === "inbox-search" ? DEMO_IDEAS.map((idea) => <EntityCard key={idea.id} label="Ідея" title={idea.title} meta={`${idea.alignment}% відповідності меті`} tone="idea" onClick={() => onNavigate("idea-detail")} />) : DEMO_TASKS.map((task) => <TaskCard key={task.id} task={task} onClick={() => onNavigate("task-detail")} />)}</div>
    </AppFrame>
  );
}
