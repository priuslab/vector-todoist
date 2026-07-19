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

it("uses native time pickers and updates work hours", () => {
  render(<OnboardingFlow screenId="work-rhythm" onNext={vi.fn()} />);

  const start = screen.getByLabelText("Початок");
  const end = screen.getByLabelText("Завершення");
  expect(start).toHaveAttribute("type", "time");
  expect(end).toHaveAttribute("type", "time");
  fireEvent.change(start, { target: { value: "10:00" } });
  expect(start).toHaveValue("10:00");
});
