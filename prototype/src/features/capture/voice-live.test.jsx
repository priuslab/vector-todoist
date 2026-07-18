import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { VoiceRecorder } from "./VoiceRecorder";

it("shows a Ukrainian permission request and fallback", async () => {
  const user = userEvent.setup();
  render(<VoiceRecorder onCancel={vi.fn()} onFinish={vi.fn()} />);
  expect(screen.getByText("Готовий записати твої думки")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Почати запис" }));
  expect(await screen.findByText("Голосовий запис недоступний")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Написати текстом" })).toBeInTheDocument();
});

it("keeps the demo recorder controls reachable", async () => {
  const user = userEvent.setup();
  const onFinish = vi.fn();
  render(<VoiceRecorder demo transcript="Думка" onCancel={vi.fn()} onFinish={onFinish} />);
  expect(screen.getByRole("button", { name: "Завершити запис" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Завершити запис" }));
  expect(onFinish).toHaveBeenCalled();
});
