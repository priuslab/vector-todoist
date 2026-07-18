import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CaptureFlow } from "./CaptureFlow";

it("persists text through the injected capture API and confirms a draft", async () => {
  const user = userEvent.setup();
  const createBrainDump = vi.fn(async () => ({ id: "dump-1", status: "draft", rawText: "Моя думка" }));
  render(<CaptureFlow createBrainDump={createBrainDump} />);
  await user.click(screen.getByRole("button", { name: "Написати текстом" }));
  const textarea = screen.getByRole("textbox", { name: "Редагувати транскрипт" });
  await user.clear(textarea);
  await user.type(textarea, "Моя думка");
  await user.click(screen.getByRole("button", { name: "Зберегти чернетку" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Збережено як чернетку"));
  expect(createBrainDump).toHaveBeenCalledWith(expect.objectContaining({ text: "Моя думка" }));
});

it("keeps the text and offers a retry after a network failure", async () => {
  const user = userEvent.setup();
  const createBrainDump = vi.fn().mockRejectedValue(new Error("offline"));
  render(<CaptureFlow createBrainDump={createBrainDump} />);
  await user.click(screen.getByRole("button", { name: "Написати текстом" }));
  const textarea = screen.getByRole("textbox", { name: "Редагувати транскрипт" });
  await user.clear(textarea); await user.type(textarea, "Залиш цю думку");
  await user.click(screen.getByRole("button", { name: "Зберегти чернетку" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося зберегти");
  expect(screen.getByDisplayValue("Залиш цю думку")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Зберегти чернетку" })).toBeInTheDocument();
});
