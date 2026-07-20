import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AIProcessing } from "./AIProcessing";
import { Clarification } from "./Clarification";
import { AIResult } from "./AIResult";
import { CaptureFlow } from "./CaptureFlow";

const analysis = {
  summary: "Потрібно підготувати випуск подкасту.",
  confidence: 0.42,
  questions: [{ id: "deadline", text: "Коли має бути готова структура епізоду?", field: "tasks[0].deadline" }],
  tasks: [{ title: "Підготувати структуру", description: "Зібрати блоки", priority: "high", estimatedMinutes: 60, deadline: null, energy: "high", confidence: 0.8 }],
  ideas: [{ text: "Епізод про синдром самозванця", summary: "Можлива тема", confidence: 0.7 }],
  context: ["У четвер є командний синк."],
};

it("shows a Ukrainian processing error without claiming a plan was created", () => {
  render(<AIProcessing error="Не вдалося завершити аналіз. Чернетку збережено." />);
  expect(screen.getByRole("alert")).toHaveTextContent("Чернетку збережено");
  expect(screen.queryByText("План готовий")).not.toBeInTheDocument();
});

it("renders at most two clarification questions and a continue action", () => {
  render(<Clarification questions={analysis.questions} onAnswer={() => {}} onTranscribe={async () => "Так"} />);
  expect(screen.getByText(analysis.questions[0].text)).toBeInTheDocument();
  const continueButton = screen.getByRole("button", { name: "Продовжити" });
  expect(continueButton).toBeInTheDocument();
  expect(continueButton.parentElement).toHaveClass("clarification__actions");
  expect(screen.getByRole("button", { name: "Відповісти голосом" }).parentElement).toBe(continueButton.parentElement);
});

it("opens a voice composer for a clarification answer", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  render(<Clarification questions={analysis.questions} onAnswer={() => {}} onTranscribe={async () => "Так"} />);

  await user.click(screen.getByRole("button", { name: "Відповісти голосом" }));
  expect(screen.getByRole("button", { name: "Почати запис" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Відповісти голосом" })).not.toBeInTheDocument();
});

it("renders an analysis preview with confidence and does not claim tasks were added to Today", () => {
  render(<AIResult analysis={analysis} onViewDay={() => {}} onUndo={() => {}} />);
  expect(screen.getByText(analysis.summary)).toBeInTheDocument();
  expect(screen.getByText(/Рекомендація AI/)).toBeInTheDocument();
  expect(screen.queryByText(/додано до сьогодні/iu)).not.toBeInTheDocument();
});

it("uses the live draft and analysis APIs in production capture flow", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  const apiClient = { request: async () => ({}) };
  const createBrainDump = async () => ({ id: "dump-live" });
  const analyze = async () => ({ analysis: { ...analysis, questions: [] } });
  render(<CaptureFlow screenId="capture-transcript" apiClient={apiClient} createBrainDump={createBrainDump} analyze={analyze} />);
  await user.click(screen.getByRole("button", { name: "Зберегти чернетку" }));
  expect(await screen.findByText(analysis.summary)).toBeInTheDocument();
});

it("does not submit an empty clarification answer", () => {
  render(<Clarification questions={analysis.questions} deferSubmit onAnswer={() => {}} />);
  expect(screen.getByRole("button", { name: "Продовжити" })).toBeDisabled();
});

it("shows the selected quick reply as pressed", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  render(<Clarification questions={analysis.questions} deferSubmit onAnswer={() => {}} />);

  await user.click(screen.getByRole("button", { name: "Ні" }));
  expect(screen.getByRole("button", { name: "Ні" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Так" })).toHaveAttribute("aria-pressed", "false");
});
