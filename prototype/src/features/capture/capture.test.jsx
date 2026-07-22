import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TodayScreens } from "../today/TodayScreens";
import { PrototypeProvider, usePrototype } from "../../state/prototypeState";
import { CaptureFlow } from "./CaptureFlow";

function FlowHarness() {
  const { route, navigate } = usePrototype();
  return route === "today-normal"
    ? <TodayScreens />
    : <CaptureFlow screenId="capture-result" onNavigate={navigate} />;
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
