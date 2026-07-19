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

it("rehydrates an active server session instead of starting a second one", async () => {
  const apiClient = { request: vi.fn(async (path) => path.startsWith("/api/v1/focus-sessions/active") ? { id: "focus-server", taskId: "task-structure", status: "paused", plannedMinutes: 50, startedAt: "2026-07-20T09:00:00.000Z", plannedEndAt: "2026-07-20T09:50:00.000Z", pausedAt: "2026-07-20T09:05:00.000Z", pausedSeconds: 0 } : null) };
  render(<FocusScreens apiClient={apiClient} taskId="task-structure" />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(apiClient.request).toHaveBeenCalledWith(expect.stringContaining("/api/v1/focus-sessions/active"));
  expect(apiClient.request).not.toHaveBeenCalledWith("/api/v1/focus-sessions/start", expect.anything());
});
