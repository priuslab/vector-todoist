import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { App } from "../../App";
import { InboxScreens } from "../inbox/InboxScreens";
import { DraftPlanReview } from "./DraftPlanReview";

const classifiedAnalysis = {
  summary: "Виділила одну задачу та одну ідею.",
  confidence: 0.91,
  tasks: [{ title: "Підготувати запуск", estimatedMinutes: 60, priority: "high", energy: "high" }],
  ideas: [{ text: "Зробити короткий гайд", summary: "Матеріал для backlog" }],
  context: [],
  questions: [],
};

const proposalTask = {
  id: "proposal-1", title: "Підготувати запуск", description: "Чернетка запуску", status: "scheduled", priority: "high",
  deadline: null, plannedStart: "2026-07-21T09:30:00+02:00", plannedEnd: "2026-07-21T10:30:00+02:00", estimatedMinutes: 60,
  energy: "high", flexible: true, locked: false, sourceDump: "dump-1", goalId: "goal-1",
};
const proposalIdea = { id: "proposal-idea-1", text: "Зробити короткий гайд", summary: "Матеріал для backlog", status: "backlog", sourceDump: "dump-1", goalId: "goal-1" };

it("reviews a saved draft, confirms its proposal and navigates to Today", async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  const request = vi.fn()
    .mockResolvedValueOnce([{ id: "goal-1", title: "Запустити застосунок", status: "active" }])
    .mockResolvedValueOnce({ analysis: classifiedAnalysis })
    .mockResolvedValueOnce({ changeSetId: "change-1", tasks: [proposalTask], ideas: [proposalIdea], blocks: [], unscheduledTaskIds: [], warnings: [], reasons: {} })
    .mockResolvedValueOnce({ changeSet: { id: "change-1", status: "applied" }, tasks: [{ id: "task-1" }], ideas: [{ id: "idea-1" }] });

  render(<DraftPlanReview draftId="dump-1" apiClient={{ request }} onNavigate={onNavigate} />);

  expect(await screen.findByText((_, element) => element?.tagName === "SPAN" && element.textContent.includes("Підготувати запуск"))).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Зберегти пропозиції" }));

  await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("today-normal"));
  expect(screen.getByText("Пропозиції збережено")).toBeInTheDocument();
  expect(request).toHaveBeenNthCalledWith(3, "/api/v1/brain-dumps/dump-1/plan-preview", expect.objectContaining({ method: "POST" }));
});

it("shows the main-goal action instead of making a proposal against a demo goal", async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  const request = vi.fn().mockResolvedValue([]);

  render(<DraftPlanReview draftId="dump-1" apiClient={{ request }} onNavigate={onNavigate} />);

  await user.click(await screen.findByRole("button", { name: "Створити головну мету" }));

  expect(onNavigate).toHaveBeenCalledWith("goal-manual");
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Зберегти пропозиції" })).not.toBeInTheDocument();
});

it("keeps the saved draft available and offers a Ukrainian retry when preview fails", async () => {
  const user = userEvent.setup();
  const request = vi.fn()
    .mockResolvedValueOnce([{ id: "goal-1", title: "Запустити застосунок", status: "active" }])
    .mockResolvedValueOnce({ analysis: classifiedAnalysis })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ analysis: classifiedAnalysis })
    .mockResolvedValueOnce({ changeSetId: "change-1", tasks: [proposalTask], ideas: [proposalIdea], blocks: [], unscheduledTaskIds: [], warnings: [], reasons: {} });

  render(<DraftPlanReview draftId="dump-1" apiClient={{ request }} />);

  expect(await screen.findByText("Чернетка лишилась у Inbox — спробуй ще раз.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Спробувати ще раз" }));
  expect(await screen.findByRole("button", { name: "Зберегти пропозиції" })).toBeInTheDocument();
});

it("exposes an AI review action for a live Inbox draft", async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  const apiClient = { request: vi.fn().mockResolvedValue({ tasks: [], ideas: [], drafts: [{ id: "dump-1", text: "Потрібно підготувати запуск", status: "classified" }] }) };

  render(<InboxScreens screenId="inbox-drafts" apiClient={apiClient} onNavigate={onNavigate} />);

  await user.click(await screen.findByRole("button", { name: "Розібрати з AI" }));
  expect(onNavigate).toHaveBeenCalledWith("draft-plan-review", { draft: "dump-1" });
});

it("keeps the draft identifier in the query route after a refresh", async () => {
  window.history.replaceState({}, "", "/?screen=draft-plan-review&draft=dump-1");
  render(<App />);

  expect(await screen.findByText("Розбір Brain Dump")).toBeInTheDocument();
  expect(window.location.search).toContain("draft=dump-1");
  window.history.replaceState({}, "", "/");
});
