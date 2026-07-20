import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { GoalSetup } from "./GoalSetup";

function GoalDiscoveryHarness({ apiClient }) {
  const [route, setRoute] = useState("goal-test-start");

  return (
    <GoalSetup
      screenId={route}
      onBack={vi.fn()}
      onNext={vi.fn()}
      onRoute={setRoute}
      apiClient={apiClient}
    />
  );
}

it("keeps an edited voice-first answer until the user explicitly sends it", async () => {
  const user = userEvent.setup();
  const apiClient = {
    request: vi.fn(async (path) => {
      if (path === "/api/v1/goals/discovery/sessions") {
        return {
          id: "session-1",
          status: "active",
          questions: [{ id: "attention", prompt: "Що зараз важливо?" }],
          answers: [],
        };
      }

      return {
        id: "session-1",
        answers: [{ id: "attention", text: "Моя відредагована відповідь" }],
        suggestion: { title: "Опорна мета", rationale: "Чернетка", confidence: 0.7 },
      };
    }),
  };

  render(<GoalDiscoveryHarness apiClient={apiClient} />);

  await user.click(screen.getByRole("button", { name: "Почати короткий діалог" }));
  expect(await screen.findByRole("button", { name: "Увімкнути текстовий режим" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Увімкнути текстовий режим" }));
  const answer = screen.getByRole("textbox", { name: "Твоя думка" });
  await user.type(answer, "Моя відповідь");
  await user.clear(answer);
  await user.type(answer, "Моя відредагована відповідь");

  expect(answer).toHaveValue("Моя відредагована відповідь");
  expect(screen.queryByRole("heading", { name: "Твоя опорна мета" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Відправити" }));

  await waitFor(() => expect(screen.getByRole("heading", { name: "Твоя опорна мета" })).toBeInTheDocument());
  expect(apiClient.request).toHaveBeenLastCalledWith(
    "/api/v1/goals/discovery/sessions/session-1/answers",
    expect.objectContaining({ method: "POST" }),
  );
});
