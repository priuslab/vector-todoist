import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CalendarScreens } from "./CalendarScreens";

const livePayload = {
  date: "2026-07-19",
  timezone: "Europe/Warsaw",
  tasks: [{ id: "task-flex", title: "Гнучка задача", status: "scheduled", estimatedMinutes: 30, plannedStart: "2026-07-19T10:00:00+02:00", plannedEnd: "2026-07-19T10:30:00+02:00", flexible: true }],
  blocks: [],
  slots: [{ id: "google-1", title: "Зайнято", start: "2026-07-19T11:00:00+02:00", end: "2026-07-19T11:45:00+02:00", locked: true }],
  syncedAt: "2026-07-19T08:00:00+02:00",
  stale: false,
};

it("switches between day and week and reads live task data", async () => {
  const apiClient = { request: vi.fn(async (path) => path.includes("today?") ? livePayload : path.includes("day?") ? livePayload : { status: "disconnected" }) };
  render(<CalendarScreens apiClient={apiClient} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Гнучка задача" })).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Гнучка задача" })).toHaveAttribute("data-locked", "false");
  fireEvent.click(screen.getByRole("button", { name: "Тиждень" }));
  expect(screen.getByRole("button", { name: "Тиждень" })).toHaveAttribute("aria-pressed", "true");
  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.stringContaining("/api/v1/calendar/day?date=")));
});

it("keeps server-locked app tasks immutable and uses live week counts", async () => {
  const apiClient = { request: vi.fn(async (path) => {
    if (path.includes("today?")) return { ...livePayload, tasks: [{ ...livePayload.tasks[0], id: "locked-task", locked: true, source: "app" }] };
    if (path.includes("day?")) return { ...livePayload, tasks: [{ id: "week-task", title: "Тижнева задача" }], slots: [] };
    return { status: "disconnected" };
  }) };
  render(<CalendarScreens apiClient={apiClient} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Гнучка задача" })).toHaveAttribute("draggable", "false"));
  fireEvent.click(screen.getByRole("button", { name: "Тиждень" }));
  await waitFor(() => expect(screen.getAllByText("1 задач").length).toBeGreaterThan(0));
});

it("does not make locked Google events draggable and exposes an accessible time form", async () => {
  const apiClient = { request: vi.fn(async (path) => path.includes("today?") || path.includes("day?") ? livePayload : { status: "disconnected" }) };
  render(<CalendarScreens apiClient={apiClient} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Зайнято" })).toBeInTheDocument());
  const locked = screen.getByRole("button", { name: "Зайнято" });
  expect(locked).toHaveAttribute("draggable", "false");
  fireEvent.click(screen.getByRole("button", { name: "Гнучка задача" }));
  expect(screen.getByLabelText("Початок" )).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("optimistically moves a flexible task and offers Undo after sync", async () => {
  const apiClient = { request: vi.fn(async (path, options) => {
    if (path.includes("today?") || path.includes("day?")) return livePayload;
    if (path.includes("/tasks/task-flex")) return { task: { ...livePayload.tasks[0], plannedStart: "2026-07-19T12:00:00+02:00", plannedEnd: "2026-07-19T12:30:00+02:00", syncStatus: "sync_pending" } };
    return { status: "disconnected" };
  }) };
  render(<CalendarScreens apiClient={apiClient} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Гнучка задача" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Гнучка задача" }));
  fireEvent.change(screen.getByLabelText("Початок"), { target: { value: "2026-07-19T12:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Зберегти час" }));
  await waitFor(() => expect(screen.getByText("Зміни очікують синхронізації")).toBeInTheDocument());
  expect(apiClient.request).toHaveBeenCalledWith("/api/v1/tasks/task-flex", expect.objectContaining({ method: "PATCH" }));
  fireEvent.click(screen.getByRole("button", { name: "Скасувати переміщення" }));
  expect(apiClient.request).toHaveBeenCalledWith("/api/v1/tasks/task-flex", expect.objectContaining({ method: "PATCH" }));
});

it("shows a calm overload explanation and recovery action", () => {
  render(<CalendarScreens screenId="calendar-overload" />);
  expect(screen.getByText("День перевантажений")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Знайти новий час" })).toBeInTheDocument();
});
