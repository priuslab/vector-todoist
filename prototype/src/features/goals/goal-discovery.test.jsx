import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { GoalSetup } from "../onboarding/GoalSetup";

it("shows Ukrainian safety copy and starts a resumable goal dialogue", async () => {
  const onRoute = vi.fn();
  const apiClient = { request: vi.fn(async () => ({ id: "session-1", status: "active", questions: [{ id: "attention", prompt: "Що зараз важливо?" }], answers: [], safetyNotice: "Це рекомендація для планування, а не медична чи психологічна оцінка." })) };
  render(<GoalSetup screenId="goal-test-start" onRoute={onRoute} apiClient={apiClient} />);
  expect(screen.getByText(/не медична/)).toBeInTheDocument();
  screen.getByRole("button", { name: "Почати короткий діалог" }).click();
  await waitFor(() => expect(onRoute).toHaveBeenCalledWith("goal-test-question"));
});
