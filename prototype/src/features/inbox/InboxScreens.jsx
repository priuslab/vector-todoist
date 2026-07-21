import { MagnifyingGlass, SlidersHorizontal, WarningCircle } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { EntityCard } from "../../components/EntityCard";
import { SegmentedControl } from "../../components/SegmentedControl";
import { StateView } from "../../components/StateView";
import { TaskCard } from "../../components/TaskCard";
import { DEMO_IDEAS, DEMO_TASKS } from "../../data/demoData";
import { getInbox } from "../today/todayApi";
import { useEffect, useState } from "react";

export function InboxScreens({ screenId = "inbox-default", onNavigate = () => {}, apiClient }) {
  const [remote, setRemote] = useState(null);
  const [remoteError, setRemoteError] = useState("");
  const [activeTab, setActiveTab] = useState(screenId === "inbox-search" ? "ideas" : "tasks");
  useEffect(() => { if (!apiClient) return; let alive = true; getInbox({ apiClient }).then((value) => alive && setRemote(value)).catch(() => alive && setRemoteError("Не вдалося завантажити Inbox. Спробуй оновити сторінку.")); return () => { alive = false; }; }, [apiClient]);
  if (screenId === "inbox-failed-draft") return <AppFrame title="Чернетка" onBack={() => onNavigate("inbox-default")} activeRoute="inbox-default" onNavigate={onNavigate}><StateView state="error" title="Думки збережено" message="AI не зміг завершити обробку, але твій Brain Dump не втрачено." action={<Button onClick={() => onNavigate("capture-processing")}>Повторити обробку</Button>} /><div className="draft-preview"><WarningCircle size={20} /><p>Мені треба підготувати перший випуск подкасту, написати Марії…</p></div></AppFrame>;
  if (apiClient && !remote && !remoteError) return <AppFrame title="Inbox" activeRoute="inbox-default" onNavigate={onNavigate} avatar><StateView state="loading" title="Завантажую Inbox" message="Збираю твої чернетки, задачі та ідеї." /></AppFrame>;
  if (apiClient && remoteError) return <AppFrame title="Inbox" activeRoute="inbox-default" onNavigate={onNavigate} avatar><StateView state="error" title="Inbox тимчасово недоступний" message={remoteError} action={<Button onClick={() => window.location.reload()}>Оновити</Button>} /></AppFrame>;
  const tasks = apiClient ? (remote?.tasks ?? []) : DEMO_TASKS;
  const ideas = apiClient ? (remote?.ideas ?? []) : DEMO_IDEAS;
  const drafts = apiClient ? (remote?.drafts ?? []) : [];
  const emptyTitle = activeTab === "ideas" ? "Ідей ще немає" : activeTab === "drafts" ? "Чернеток ще немає" : "Inbox порожній";
  const selectedItems = activeTab === "ideas" ? ideas : activeTab === "drafts" ? drafts : tasks;
  return (
    <AppFrame title="Inbox" eyebrow="7 елементів" activeRoute="inbox-default" onNavigate={onNavigate} avatar>
      <div className="inbox-tools"><label><MagnifyingGlass size={18} /><input aria-label="Пошук" placeholder="Знайти задачу або ідею" /></label><button aria-label="Фільтри"><SlidersHorizontal size={20} /></button></div>
      <SegmentedControl items={[{value:"tasks",label:"Задачі"},{value:"ideas",label:"Ідеї"},{value:"drafts",label:"Чернетки"}]} value={activeTab} onChange={setActiveTab} />
      {selectedItems.length === 0 ? <StateView state="empty" title={emptyTitle} message={activeTab === "drafts" ? "Текстові й голосові Brain Dump з’являться тут одразу після збереження." : "Зроби Brain Dump — нові пропозиції з’являться тут."} action={<Button onClick={() => onNavigate("capture-chooser")}>Зробити Brain Dump</Button>} /> : <div className="inbox-section"><div className="section-row"><h2>{activeTab === "ideas" ? "Ідеї" : activeTab === "drafts" ? "Чернетки" : "Задачі"}</h2><span>{selectedItems.length}</span></div>{activeTab === "ideas" ? ideas.map((idea) => <EntityCard key={idea.id} label="Ідея" title={idea.title ?? idea.text} meta={idea.summary ?? "Збережено в backlog"} tone="idea" onClick={() => onNavigate("idea-detail")} />) : activeTab === "drafts" ? drafts.map((draft) => <article className="entity-card entity-card--brand" key={draft.id}><span className="entity-card__label">Brain Dump</span><strong>{draft.text}</strong><span className="entity-card__meta">{draft.status === "classified" ? "Оброблено AI" : draft.status === "needs_clarification" ? "Потрібне уточнення" : "Збережено як чернетку"}</span></article>) : tasks.map((task) => <TaskCard key={task.id} task={{ ...task, duration: task.duration ?? task.estimatedMinutes }} onClick={() => onNavigate("task-detail")} />)}</div>}
    </AppFrame>
  );
}
