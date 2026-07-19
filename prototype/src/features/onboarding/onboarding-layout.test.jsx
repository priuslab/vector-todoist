import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { OnboardingFlow } from "./OnboardingFlow";
import { GoalSetup } from "./GoalSetup";
import { TelegramSetup } from "./TelegramSetup";

it("places welcome actions in the persistent footer", () => {
  render(<OnboardingFlow screenId="onboarding-welcome" onNext={vi.fn()} />);
  const footer = screen.getByTestId("action-footer");
  expect(within(footer).getByRole("button", { name: "Продовжити" })).toBeInTheDocument();
  expect(within(footer).getByRole("button", { name: "Налаштувати пізніше" })).toBeInTheDocument();
  expect(screen.getByTestId("action-footer-content")).toHaveTextContent("Налаштуй Вектор під свій ритм");
});

it("keeps the manual goal form in content and its save action in the footer", () => {
  render(<GoalSetup screenId="goal-manual" onNext={vi.fn()} onRoute={vi.fn()} />);
  expect(screen.getByTestId("action-footer-content")).toHaveTextContent("Сформулюй свою мету");
  expect(within(screen.getByTestId("action-footer")).getByRole("button", { name: "Зберегти мету" })).toBeInTheDocument();
});

it("places Telegram setup actions in the footer", () => {
  render(<TelegramSetup screenId="telegram-connect" onNext={vi.fn()} />);
  const footer = screen.getByTestId("action-footer");
  expect(within(footer).getByRole("button", { name: "Відкрити Telegram" })).toBeInTheDocument();
  expect(within(footer).getByRole("button", { name: "Підключити пізніше" })).toBeInTheDocument();
});

it("centers the goal-test result heading without centering manual goal forms", () => {
  const result = render(<GoalSetup screenId="goal-test-result" onNext={vi.fn()} onRoute={vi.fn()} />);
  expect(result.container.querySelector(".goal-test-result-content")).toBeInTheDocument();
  expect(result.container.querySelector(".goal-test-result-content .section-heading")).toBeInTheDocument();
  result.unmount();

  const manual = render(<GoalSetup screenId="goal-manual" onNext={vi.fn()} onRoute={vi.fn()} />);
  expect(manual.container.querySelector(".goal-test-result-content")).not.toBeInTheDocument();
});

it("opens custom time pickers and updates work hours", () => {
  render(<OnboardingFlow screenId="work-rhythm" onNext={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Початок 09:00" }));
  expect(screen.getByRole("dialog", { name: "Вибери час початку" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("option", { name: "10:00" }));
  expect(screen.getByRole("button", { name: "Початок 10:00" })).toBeInTheDocument();
});

it("makes quiet hours and focus settings editable", () => {
  const quiet = render(<OnboardingFlow screenId="quiet-hours" onNext={vi.fn()} />);
  expect(quiet.getByRole("button", { name: "Тиха година початку 21:00" })).toBeInTheDocument();
  expect(quiet.getByRole("button", { name: "Тиха година завершення 08:00" })).toBeInTheDocument();
  quiet.unmount();

  render(<OnboardingFlow screenId="focus-settings" onNext={vi.fn()} />);
  expect(screen.getByLabelText("Фокус-блок").tagName).toBe("SELECT");
  expect(screen.getByLabelText("Перерва").tagName).toBe("SELECT");
  expect(screen.getByLabelText("Денний ліміт").tagName).toBe("SELECT");
});

it("uses a native date picker for a manually entered goal", () => {
  render(<GoalSetup screenId="goal-manual" onNext={vi.fn()} onRoute={vi.fn()} />);
  expect(screen.getByLabelText("Строк")).toHaveAttribute("type", "date");
});
