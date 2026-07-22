import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TodayScreens } from "./TodayScreens";

it("shows a reschedule preview before applying and exposes an explicit Undo state", async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  const apiClient = { request: vi.fn(async (url) => url.includes("today?") ? ({ tasks: [{ id: "task-1", title: "Лист Марії", status: "scheduled" }] }) : url.includes("reschedule-preview") ? ({ changes: [{ taskId: "task-1", title: "Лист Марії", changed: true, after: { plannedStart: "2026-07-19T12:30:00+02:00" } }], warnings: [], unscheduledTaskIds: [] }) : ({ changeSet: { id: "change-1", status: "applied" } })) };
  render(<TodayScreens screenId="today-overload" apiClient={apiClient} onNavigate={onNavigate} />);

  await user.click(await screen.findByRole("button", { name: "Переглянути новий план" }));
  expect(await screen.findByText("Що зміниться")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Застосувати перепланування" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Перепланування застосовано"));
  expect(onNavigate).not.toHaveBeenCalled();
  expect(apiClient.request).toHaveBeenCalledWith("/api/v1/plans/reschedule-preview", expect.any(Object));
});
