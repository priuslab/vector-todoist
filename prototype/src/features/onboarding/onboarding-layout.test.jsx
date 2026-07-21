import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  window.localStorage.clear();
  render(<OnboardingFlow screenId="work-rhythm" onNext={vi.fn()} />);

  expect(screen.queryByRole("button", { name: "Власні" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Початок 09:00" }));
  expect(screen.getByRole("dialog", { name: "Вибери час початку" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("option", { name: "10:00" }));
  expect(screen.getByRole("button", { name: "Початок 10:00" })).toBeInTheDocument();
});

it("restores onboarding values after the screen is remounted", () => {
  window.localStorage.clear();
  const first = render(<OnboardingFlow screenId="work-rhythm" onNext={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Початок 09:00" }));
  fireEvent.click(screen.getByRole("option", { name: "10:00" }));
  first.unmount();

  render(<OnboardingFlow screenId="work-rhythm" onNext={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Початок 10:00" })).toBeInTheDocument();
});

it("marks the current onboarding step in the progress indicator", () => {
  const { container } = render(<OnboardingFlow screenId="energy-peak" onNext={vi.fn()} />);

  expect(container.querySelectorAll(".onboarding-progress .is-active")).toHaveLength(3);
});

it("updates the energy window when a different energy period is selected", () => {
  window.localStorage.clear();
  render(<OnboardingFlow screenId="energy-peak" onNext={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Вечір" }));

  expect(screen.getByText("17:00–20:00")).toBeInTheDocument();
  expect(screen.getByText("Вечірній фокус плануватиметься тут")).toBeInTheDocument();
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

it("gives onboarding selects a 48px mobile tap target", () => {
  const settingsCss = readFileSync(resolve(process.cwd(), "src/styles/settings.css"), "utf8");

  expect(settingsCss).toMatch(/\.form-stack select[^}]*min-height:\s*48px/);
});

it("keeps the mobile app inside the viewport instead of letting Safari reveal the page background", () => {
  const globalCss = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");

  expect(globalCss).toMatch(/body\s*\{[\s\S]*?overflow:\s*hidden/);
  expect(globalCss).toMatch(/\.mobile-prototype\s*\{[\s\S]*?min-height:\s*100svh/);
});

it("uses a native date picker for a manually entered goal", () => {
  render(<GoalSetup screenId="goal-manual" onNext={vi.fn()} onRoute={vi.fn()} />);
  expect(screen.getByLabelText("Строк")).toHaveAttribute("type", "date");
});
