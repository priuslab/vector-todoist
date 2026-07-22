export const DEMO_USER = {
  name: "Олена",
  initials: "ОК",
  workStart: "09:00",
  workEnd: "18:00",
  energyPeak: "09:30–12:30",
};

export const DEMO_GOAL = {
  id: "goal-podcast",
  title: "Запустити перший сезон подкасту про кар'єрні зміни до 30 вересня",
  progress: 42,
  deadline: "30 вересня",
};

export const DEMO_PROJECTS = [
  { id: "project-pilot", title: "Пілотний епізод", progress: 38, goalId: DEMO_GOAL.id },
];

export const DEMO_TASKS = [
  {
    id: "task-structure",
    title: "Підготувати структуру першого епізоду",
    duration: 60,
    start: "09:30",
    end: "10:30",
    energy: "Висока",
    type: "deep",
    alignment: 94,
    priority: "Високий",
    deadline: "До четверга",
    projectId: "project-pilot",
    flexible: true,
  },
  {
    id: "task-guest",
    title: "Написати лист потенційному гостю",
    duration: 20,
    start: "12:00",
    end: "12:20",
    energy: "Низька",
    type: "routine",
    alignment: 81,
    priority: "Середній",
    deadline: "Цього тижня",
    projectId: "project-pilot",
    flexible: true,
  },
  {
    id: "task-cat-food",
    title: "Замовити корм коту",
    duration: 10,
    start: "17:10",
    end: "17:20",
    energy: "Низька",
    type: "neutral",
    alignment: 12,
    priority: "Низький",
    deadline: "Сьогодні",
    flexible: true,
  },
];

export const DEMO_EVENTS = [
  {
    id: "event-sync",
    title: "Командний синк",
    start: "11:00",
    end: "11:45",
    source: "google",
    locked: true,
  },
];

export const DEMO_IDEAS = [
  {
    id: "idea-impostor",
    title: "Зробити епізод про синдром самозванця",
    alignment: 86,
    projectId: "project-pilot",
  },
  {
    id: "idea-youtube",
    title: "Почати паралельно YouTube-канал",
    alignment: 24,
  },
];

export const DEMO_DRAFTS = [
  { id: "draft-run-10k", text: "Хочу бігати 10 км.", status: "needs_clarification" },
  { id: "draft-run-weekly", text: "Бігати 10 км 1 раз на тиждень", status: "saved" },
  { id: "draft-run-training", text: "Потрібно скласти план тренувань для бігу", status: "needs_clarification" },
];

export const DEMO_BRAIN_DUMP =
  "Мені треба підготувати перший випуск подкасту, написати Марії про запис, ще не забути замовити корм коту. Думаю зробити окремий епізод про синдром самозванця, але не знаю, чи варто зараз ще запускати YouTube. У четвер об 11 у мене командний синк";

export function buildPlanFromBrainDump(text = DEMO_BRAIN_DUMP) {
  const normalized = text.toLocaleLowerCase("uk-UA");
  const tasks = DEMO_TASKS.filter((task) => {
    if (task.id === "task-structure") return /підгот|випуск|подкаст|епізод/.test(normalized);
    if (task.id === "task-guest") return /марі|лист|гост/.test(normalized);
    if (task.id === "task-cat-food") return /корм|кіт|кот/.test(normalized);
    return false;
  });

  if (tasks.length > 0) return tasks;
  return [{
    id: "task-brain-dump-1",
    title: text.trim().split(/[.!?]/)[0] || "Розібрати наступну думку",
    duration: 25,
    start: "09:30",
    end: "09:55",
    priority: "Середній",
    deadline: "Сьогодні",
    energy: "Середня",
    type: "routine",
    alignment: 50,
    flexible: true,
  }];
}
