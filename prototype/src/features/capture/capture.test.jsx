import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TodayScreens } from "../today/TodayScreens";
import { CalendarScreens } from "../calendar/CalendarScreens";
import { PrototypeProvider, usePrototype } from "../../state/prototypeState";
import { CaptureFlow } from "./CaptureFlow";

function FlowHarness() {
  const { route, navigate } = usePrototype();
  if (route === "today-normal") return <TodayScreens />;
  if (route === "calendar-day") return <CalendarScreens />;
  return <CaptureFlow screenId={route === "draft-plan-review" ? "draft-plan-review" : "capture-result"} onNavigate={navigate} processingDelayMs={10} />;
}

it("moves from voice capture to AI processing", async () => {
  const user = userEvent.setup();
  render(<CaptureFlow />);

  await user.click(screen.getByRole("button", { name: "Диктувати" }));
  await user.click(screen.getByRole("button", { name: "Завершити запис" }));

  expect(screen.getByText("Розпізнаю думки")).toBeInTheDocument();
});

it("asks a critical question after processing when confidence is low", async () => {
  render(<CaptureFlow screenId="capture-processing" processingDelayMs={10} />);

  await waitFor(() => expect(screen.getByText("Коли має бути готова структура першого епізоду?")).toBeInTheDocument());
});

it("lets the user apply the analyzed plan and continue to Today", async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  render(<CaptureFlow screenId="capture-result" onNavigate={onNavigate} />);

  await user.click(screen.getByRole("button", { name: "Застосувати план" }));

  expect(onNavigate).toHaveBeenCalledWith("today-normal");
});

it("keeps the generated tasks in the shared state after applying the plan", async () => {
  const user = userEvent.setup();
  render(<PrototypeProvider initialRoute="capture-result"><FlowHarness /></PrototypeProvider>);

  await user.click(screen.getByRole("button", { name: "Застосувати план" }));

  expect(screen.getByText("Підготувати структуру першого епізоду")).toBeInTheDocument();
  expect(screen.getByText("Написати лист потенційному гостю")).toBeInTheDocument();
  const firstTask = screen.getByText("Підготувати структуру першого епізоду").closest(".now-card");
  expect(firstTask).toHaveTextContent("Високий пріоритет");
  expect(firstTask).toHaveTextContent("до четверга");
});

it("offers a saved Brain Dump either as an idea or as an AI plan", async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  render(<CaptureFlow screenId="draft-plan-review" onNavigate={onNavigate} processingDelayMs={10} />);

  expect(screen.getByText("Зберегти як ідею")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Зберегти як ідею" }));
  expect(onNavigate).toHaveBeenCalledWith("inbox-ideas");

  cleanup();
  onNavigate.mockClear();
  render(<PrototypeProvider initialRoute="draft-plan-review"><FlowHarness /></PrototypeProvider>);
  await user.click(screen.getByRole("button", { name: "Розібрати з AI" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Обрати вільні слоти" })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Обрати вільні слоти" }));
  expect(screen.getByText("Обери час для задачі")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Обрати 09:30/ }));
  expect(screen.getByRole("button", { name: /Хочу бігати 10 км/ })).toBeInTheDocument();
});
