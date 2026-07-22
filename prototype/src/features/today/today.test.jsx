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

it("opens the drafts tab and starts AI review from a saved Brain Dump", async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  render(<InboxScreens onNavigate={onNavigate} />);

  await user.click(screen.getByRole("button", { name: "Чернетки" }));
  expect(screen.getByText("Хочу бігати 10 км.")).toBeInTheDocument();
  await user.click(screen.getAllByRole("button", { name: "Розібрати з AI" })[0]);

  expect(onNavigate).toHaveBeenCalledWith("draft-plan-review");
});
