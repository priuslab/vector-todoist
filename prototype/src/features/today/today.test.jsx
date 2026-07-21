import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TodayScreens } from "./TodayScreens";
import { InboxScreens } from "../inbox/InboxScreens";
import { IdeaProjectScreens } from "../inbox/IdeaProjectScreens";
import { TaskScreens } from "../task/TaskScreens";
import { FocusScreens } from "../focus/FocusScreens";

it("shows what moved and hides the notice after Undo", async () => {
  const user = userEvent.setup();
  render(<TodayScreens screenId="today-rescheduled" />);

  expect(screen.getByText("План змінився — я знайшов новий час.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Скасувати" }));
  expect(screen.queryByText("План змінився — я знайшов новий час.")).not.toBeInTheDocument();
});

it("renders the planning detail families", () => {
  const { rerender } = render(<InboxScreens screenId="inbox-default" />);
  expect(screen.getAllByText("Задачі").length).toBeGreaterThan(0);
  rerender(<IdeaProjectScreens screenId="idea-detail" />);
  expect(screen.getByText("Зробити епізод про синдром самозванця")).toBeInTheDocument();
  rerender(<TaskScreens screenId="task-detail" />);
  expect(screen.getByText("Підготувати структуру першого епізоду")).toBeInTheDocument();
  rerender(<FocusScreens screenId="focus-mode" />);
  expect(screen.getByText("50:00")).toBeInTheDocument();
});

it("shows saved Brain Dump drafts in the Inbox drafts tab", async () => {
  const user = userEvent.setup();
  const apiClient = { request: vi.fn().mockResolvedValue({ tasks: [], ideas: [], drafts: [{ id: "dump-1", text: "Потрібно підготувати запуск сайту", status: "classified", created: "2026-07-21 13:00:00" }] }) };
  render(<InboxScreens screenId="inbox-default" apiClient={apiClient} />);

  await user.click(await screen.findByRole("button", { name: "Чернетки" }));

  expect(screen.getByText("Потрібно підготувати запуск сайту")).toBeInTheDocument();
  expect(screen.getByText("Оброблено AI")).toBeInTheDocument();
});

it("opens the saved Brain Dump directly in drafts instead of hiding it behind the tasks tab", async () => {
  const apiClient = { request: vi.fn().mockResolvedValue({ tasks: [], ideas: [], drafts: [{ id: "dump-2", text: "Мій щойно збережений запис", status: "received" }] }) };
  render(<InboxScreens screenId="inbox-drafts" apiClient={apiClient} />);

  expect(await screen.findByText("Мій щойно збережений запис")).toBeInTheDocument();
});

it("selects drafts in the default Inbox when a live account only has saved Brain Dumps", async () => {
  const apiClient = { request: vi.fn().mockResolvedValue({ tasks: [], ideas: [], drafts: [{ id: "dump-3", text: "Запис не має загубитися", status: "received" }] }) };
  render(<InboxScreens apiClient={apiClient} />);

  expect(await screen.findByText("Запис не має загубитися")).toBeInTheDocument();
});
