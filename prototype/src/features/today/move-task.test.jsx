import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TodayScreens } from "./TodayScreens";

function makeTasks() {
  return [
    { id: "task-1", title: "Підготувати структуру", status: "scheduled", estimatedMinutes: 60, plannedStart: "2026-07-21T09:30:00+02:00", plannedEnd: "2026-07-21T10:30:00+02:00", version: 1 },
    { id: "task-2", title: "Написати лист гостю", status: "scheduled", estimatedMinutes: 30, plannedStart: "2026-07-21T11:00:00+02:00", plannedEnd: "2026-07-21T11:30:00+02:00", version: 1 },
  ];
}

it("opens the time sheet on tap and PATCHes plannedStart/plannedEnd on save", async () => {
  const user = userEvent.setup();
  const tasks = makeTasks();
  const apiClient = {
    request: vi.fn(async (url, options = {}) => {
      if (url.includes("/api/v1/today?")) return { date: "2026-07-21", timezone: "Europe/Warsaw", tasks, blocks: [], warnings: [] };
      if (options.method === "PATCH") return { task: { ...tasks[0], plannedStart: "2026-07-21T10:00:00.000Z", plannedEnd: "2026-07-21T11:00:00.000Z" }, changeSet: { id: "change-1" } };
      return {};
    }),
  };
  render(<TodayScreens apiClient={apiClient} />);

  await screen.findByText("Написати лист гостю");
  await user.click(screen.getByText("Написати лист гостю"));

  const dialog = await screen.findByRole("dialog", { name: "Змінити час" });
  expect(within(dialog).getByText("Написати лист гостю")).toBeInTheDocument();

  await user.click(within(dialog).getByRole("button", { name: /Початок/ }));
  const timeDialog = await screen.findByRole("dialog", { name: "Обери початок" });
  await user.click(within(timeDialog).getByRole("option", { name: /10:00/ }));

  await user.click(within(dialog).getByRole("button", { name: "Зберегти час" }));

  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(
    expect.stringContaining("/api/v1/tasks/task-2"),
    expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"plannedStart"') })
  ));
  const patchCall = apiClient.request.mock.calls.find(([url, options]) => url.includes("/api/v1/tasks/task-2") && options?.method === "PATCH");
  const body = JSON.parse(patchCall[1].body);
  expect(body.plannedStart).toBeDefined();
  expect(body.plannedEnd).toBeDefined();

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Змінити час" })).not.toBeInTheDocument());
});

it("rolls back and shows an error when the PATCH fails", async () => {
  const user = userEvent.setup();
  const tasks = makeTasks();
  const apiClient = {
    request: vi.fn(async (url, options = {}) => {
      if (url.includes("/api/v1/today?")) return { date: "2026-07-21", timezone: "Europe/Warsaw", tasks, blocks: [], warnings: [] };
      if (options.method === "PATCH") throw new Error("boom");
      return {};
    }),
  };
  render(<TodayScreens apiClient={apiClient} />);

  await screen.findByText("Написати лист гостю");
  const orderBefore = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);

  await user.click(screen.getByText("Написати лист гостю"));
  const dialog = await screen.findByRole("dialog", { name: "Змінити час" });
  await user.click(within(dialog).getByRole("button", { name: "Зберегти час" }));

  await waitFor(() => expect(screen.getByText("Не вдалося перенести задачу. План повернуто до попереднього стану.")).toBeInTheDocument());
  const orderAfter = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
  expect(orderAfter).toEqual(orderBefore);
});
