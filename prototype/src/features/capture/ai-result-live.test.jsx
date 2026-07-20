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

it("renders a relevant voice or text answer action for a live clarification", () => {
  render(<Clarification questions={analysis.questions} onAnswer={() => {}} onTranscribe={async () => "Так"} />);
  expect(screen.getByText(analysis.questions[0].text)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Відповісти голосом" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Написати відповідь" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Так" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ні" })).not.toBeInTheDocument();
});

it("opens a voice composer for a clarification answer", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  render(<Clarification questions={analysis.questions} onAnswer={() => {}} onTranscribe={async () => "Так"} />);

  await user.click(screen.getByRole("button", { name: "Відповісти голосом" }));
  expect(screen.getByRole("button", { name: "Почати запис" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Відповісти голосом" })).not.toBeInTheDocument();
});

it("opens an editable text answer for a live clarification", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  render(<Clarification questions={analysis.questions} onAnswer={() => {}} onTranscribe={async () => "Так"} />);

  await user.click(screen.getByRole("button", { name: "Написати відповідь" }));
  expect(screen.getByRole("textbox", { name: "Твоя думка" })).toBeInTheDocument();
});

it("renders an analysis preview with confidence and does not claim tasks were added to Today", () => {
  render(<AIResult analysis={analysis} onViewDay={() => {}} onUndo={() => {}} />);
  expect(screen.getByText(analysis.summary)).toBeInTheDocument();
  expect(screen.getByText(/Рекомендація AI/)).toBeInTheDocument();
  expect(screen.queryByText(/додано до сьогодні/iu)).not.toBeInTheDocument();
});

it("offers to save an unscheduled proposal to Inbox instead of promising a Today plan", () => {
  render(<AIResult
    analysis={analysis}
    preview={{
      changeSetId: "change-no-slot",
      tasks: [{ ...analysis.tasks[0], id: "task-no-slot", status: "inbox" }],
      ideas: [],
      blocks: [],
      unscheduledTaskIds: ["task-no-slot"],
      warnings: ["Задача потребує нового місця в плані"],
    }}
    onApply={() => {}}
    onUndo={() => {}}
  />);

  expect(screen.getByRole("button", { name: "Зберегти в Inbox" })).toBeInTheDocument();
  expect(screen.getByText("60 хв · high · Inbox")).toBeInTheDocument();
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

it("uses the answer response instead of replacing it with a stale clarification result", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  const clarification = { ...analysis, questions: [analysis.questions[0]] };
  const completed = { ...analysis, summary: "План після уточнення готовий", questions: [] };
  const createBrainDump = async () => ({ id: "dump-answer" });
  const answer = async () => ({ analysis: completed });

  render(<CaptureFlow
    screenId="capture-transcript"
    apiClient={{ request: async () => ({}) }}
    createBrainDump={createBrainDump}
    analyze={async () => ({ analysis: clarification })}
    answer={answer}
    fetchResult={async () => ({ analysis: clarification })}
  />);

  await user.click(screen.getByRole("button", { name: "Зберегти чернетку" }));
  await user.click(await screen.findByRole("button", { name: "Написати відповідь" }));
  const response = screen.getByRole("textbox", { name: "Твоя думка" });
  await user.type(response, "Сайт майже готовий");
  await user.click(screen.getByRole("button", { name: "Продовжити" }));

  expect(await screen.findByText("План після уточнення готовий")).toBeInTheDocument();
  expect(screen.queryByText(clarification.questions[0].text)).not.toBeInTheDocument();
});

it("does not submit an empty clarification answer", () => {
  render(<Clarification deferSubmit onAnswer={() => {}} />);
  expect(screen.getByRole("button", { name: "Продовжити" })).toBeDisabled();
});

it("shows the selected quick reply as pressed", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  render(<Clarification deferSubmit onAnswer={() => {}} />);

  await user.click(screen.getByRole("button", { name: "До кінця тижня" }));
  expect(screen.getByRole("button", { name: "До кінця тижня" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "До четверга" })).toHaveAttribute("aria-pressed", "false");
});
