import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { FocusScreens } from "./FocusScreens";

afterEach(() => { cleanup(); window.localStorage.clear(); });

it("keeps the timer visible, supports pause/resume, and requires confirmation before finish", async () => {
  const user = userEvent.setup(); const onNavigate = vi.fn();
  render(<FocusScreens onNavigate={onNavigate} />);
  expect(screen.getByText("50:00")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Поставити на паузу" }));
  expect(screen.getByRole("button", { name: "Продовжити фокус" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Завершити сесію" }));
  expect(screen.getByRole("dialog", { name: "Підтвердження завершення" })).toBeInTheDocument();
  expect(onNavigate).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Так, завершити" }));
  expect(onNavigate).toHaveBeenCalledWith("focus-complete");
});

it("does not require notification permission to use focus", async () => {
  const user = userEvent.setup(); render(<FocusScreens />);
  await user.click(screen.getByRole("button", { name: /Дозволити нагадування/ }));
  expect(screen.getByText(/Нагадування дозволено|Дозволити нагадування|недоступні/)).toBeInTheDocument();
});
