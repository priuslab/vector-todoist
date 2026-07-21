import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
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
const captureStyles = readFileSync(resolve(process.cwd(), "src/styles/capture.css"), "utf8");

it("keeps proposed task text at the 12 px accessibility minimum", () => {
  expect(captureStyles).toMatch(/\.scheduled-preview span[^}]*font-size:\s*12px/);
});

it("keeps the saved result and its actions visible after confirming a draft proposal", async () => {
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

  expect(await screen.findByText("Пропозиції збережено")).toBeInTheDocument();
  expect(screen.getByText("Збережено 1 задача і 1 ідея.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "До плану на сьогодні" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "В Inbox" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "В Oracle" })).toBeInTheDocument();
  expect(onNavigate).not.toHaveBeenCalled();
  expect(request).toHaveBeenNthCalledWith(3, "/api/v1/brain-dumps/dump-1/plan-preview", expect.objectContaining({ method: "POST" }));
});

it.each([
  [2, 2, "Збережено 2 задачі і 2 ідеї."],
  [4, 4, "Збережено 4 задачі і 4 ідеї."],
  [5, 5, "Збережено 5 задач і 5 ідей."],
])("uses Ukrainian plurals for %i saved tasks and %i ideas", async (taskCount, ideaCount, message) => {
  const user = userEvent.setup();
  const request = vi.fn()
    .mockResolvedValueOnce([{ id: "goal-1", title: "Запустити застосунок", status: "active" }])
    .mockResolvedValueOnce({ analysis: classifiedAnalysis })
    .mockResolvedValueOnce({ changeSetId: "change-1", tasks: [proposalTask], ideas: [proposalIdea], blocks: [], unscheduledTaskIds: [], warnings: [], reasons: {} })
    .mockResolvedValueOnce({ changeSet: { id: "change-1", status: "applied" }, tasks: Array.from({ length: taskCount }, (_, index) => ({ id: `task-${index}` })), ideas: Array.from({ length: ideaCount }, (_, index) => ({ id: `idea-${index}` })) });

  render(<DraftPlanReview draftId="dump-1" apiClient={{ request }} />);
  await user.click(await screen.findByRole("button", { name: "Зберегти пропозиції" }));

  expect(await screen.findByText(message)).toBeInTheDocument();
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

it("keeps one stable preview instant across a retry after the preview response is lost", async () => {
  const user = userEvent.setup();
  const request = vi.fn()
    .mockResolvedValueOnce([{ id: "goal-1", title: "Запустити застосунок", status: "active" }])
    .mockResolvedValueOnce({ analysis: classifiedAnalysis })
    .mockRejectedValueOnce(new Error("response lost"))
    .mockResolvedValueOnce({ analysis: classifiedAnalysis })
    .mockResolvedValueOnce({ changeSetId: "change-1", tasks: [proposalTask], ideas: [proposalIdea], blocks: [], unscheduledTaskIds: [], warnings: [], reasons: {} });

  render(<DraftPlanReview draftId="dump-1" apiClient={{ request }} />);

  await user.click(await screen.findByRole("button", { name: "Спробувати ще раз" }));
  await screen.findByRole("button", { name: "Зберегти пропозиції" });

  const firstPreview = JSON.parse(request.mock.calls[2][1].body);
  const retriedPreview = JSON.parse(request.mock.calls[4][1].body);
  expect(firstPreview.now).toEqual(expect.any(String));
  expect(retriedPreview.now).toBe(firstPreview.now);
  expect(retriedPreview.idempotencyKey).toBe(firstPreview.idempotencyKey);
});

it("exposes an AI review action for a live Inbox draft", async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  const apiClient = { request: vi.fn().mockResolvedValue({ tasks: [], ideas: [], drafts: [{ id: "dump-1", text: "Потрібно підготувати запуск", status: "classified" }] }) };

  render(<InboxScreens screenId="inbox-drafts" apiClient={apiClient} onNavigate={onNavigate} />);

  await user.click(await screen.findByRole("button", { name: "Розібрати з AI" }));
  expect(onNavigate).toHaveBeenCalledWith("draft-plan-review", { draft: "dump-1" });
});

function authenticatedPocketBase() {
  return {
    authStore: {
      isValid: true,
      token: "test-token",
      record: { id: "olena", onboardingCompleted: true },
      clear: vi.fn(),
      onChange(listener, immediate) {
        if (immediate) listener(this.token, this.record);
        return () => {};
      },
    },
  };
}

it("prioritizes a draft review query after a refresh from any authenticated pathname", async () => {
  window.history.replaceState({}, "", "/oracle?screen=draft-plan-review&draft=dump-1");
  render(<App env={{ MODE: "production", VITE_POCKETBASE_URL: "http://pocketbase.test" }} pocketBase={authenticatedPocketBase()} />);

  expect(await screen.findByText("Розбір Brain Dump")).toBeInTheDocument();
  expect(window.location.search).toContain("draft=dump-1");
  window.history.replaceState({}, "", "/");
});
