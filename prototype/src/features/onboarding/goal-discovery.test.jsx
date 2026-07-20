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

  await user.click(screen.getByRole("button", { name: "Відповісти" }));

  await waitFor(() => expect(screen.getByRole("heading", { name: "Твоя опорна мета" })).toBeInTheDocument());
  expect(apiClient.request).toHaveBeenLastCalledWith(
    "/api/v1/goals/discovery/sessions/session-1/answers",
    expect.objectContaining({ method: "POST" }),
  );
});

it("starts each goal question with an empty draft and persists its matching edited answer", async () => {
  const user = userEvent.setup();
  const questions = [
    { id: "attention", prompt: "Що зараз забирає найбільше твоєї уваги?" },
    { id: "result", prompt: "Який результат дав би відчуття руху вперед?" },
  ];
  const apiClient = {
    request: vi.fn(async (path, options) => {
      if (path === "/api/v1/goals/discovery/sessions") {
        return { id: "session-1", status: "active", questions, answers: [] };
      }

      const [{ id, text }] = JSON.parse(options.body);
      if (id === "attention") {
        return { id: "session-1", status: "active", questions, answers: [{ id, text }] };
      }

      return {
        id: "session-1",
        questions,
        answers: [
          { id: "attention", text: "Відредагована перша відповідь" },
          { id, text },
        ],
        suggestion: { title: "Опорна мета", rationale: "Чернетка", confidence: 0.7 },
      };
    }),
  };

  render(<GoalDiscoveryHarness apiClient={apiClient} />);

  await user.click(screen.getByRole("button", { name: "Почати короткий діалог" }));
  await user.click(screen.getByRole("button", { name: "Увімкнути текстовий режим" }));
  const firstAnswer = screen.getByRole("textbox", { name: "Твоя думка" });
  await user.type(firstAnswer, "Перша відповідь");
  await user.clear(firstAnswer);
  await user.type(firstAnswer, "Відредагована перша відповідь");
  await user.click(screen.getByRole("button", { name: "Відповісти" }));

  expect(await screen.findByRole("heading", { name: "Який результат дав би відчуття руху вперед?" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Увімкнути текстовий режим" }));
  const secondAnswer = screen.getByRole("textbox", { name: "Твоя думка" });
  expect(secondAnswer).toHaveValue("");
  await user.type(secondAnswer, "Відредагована друга відповідь");
  await user.click(screen.getByRole("button", { name: "Відповісти" }));

  await waitFor(() => expect(screen.getByRole("heading", { name: "Твоя опорна мета" })).toBeInTheDocument());
  const answerCalls = apiClient.request.mock.calls.filter(([path]) => path.endsWith("/answers"));
  expect(answerCalls).toHaveLength(2);
  expect(JSON.parse(answerCalls[0][1].body)).toEqual([{ id: "attention", text: "Відредагована перша відповідь" }]);
  expect(JSON.parse(answerCalls[1][1].body)).toEqual([{ id: "result", text: "Відредагована друга відповідь" }]);
});

it("disables the goal answer control until its pending request settles", async () => {
  const user = userEvent.setup();
  let resolveAnswer;
  const apiClient = {
    request: vi.fn((path) => {
      if (path === "/api/v1/goals/discovery/sessions") {
        return Promise.resolve({
          id: "session-1",
          status: "active",
          questions: [{ id: "attention", prompt: "Що зараз важливо?" }],
          answers: [],
        });
      }

      return new Promise((resolve) => { resolveAnswer = resolve; });
    }),
  };

  render(<GoalDiscoveryHarness apiClient={apiClient} />);

  await user.click(screen.getByRole("button", { name: "Почати короткий діалог" }));
  await user.click(screen.getByRole("button", { name: "Увімкнути текстовий режим" }));
  await user.type(screen.getByRole("textbox", { name: "Твоя думка" }), "Моя відповідь");
  const submit = screen.getByRole("button", { name: "Відповісти" });
  await user.click(submit);

  await waitFor(() => expect(submit).toBeDisabled());
  await user.click(submit);
  expect(apiClient.request.mock.calls.filter(([path]) => path.endsWith("/answers"))).toHaveLength(1);

  resolveAnswer({
    id: "session-1",
    answers: [{ id: "attention", text: "Моя відповідь" }],
    suggestion: { title: "Опорна мета", rationale: "Чернетка", confidence: 0.7 },
  });
  await waitFor(() => expect(screen.getByRole("heading", { name: "Твоя опорна мета" })).toBeInTheDocument());
});
