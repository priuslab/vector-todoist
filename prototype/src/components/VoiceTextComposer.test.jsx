import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { VoiceTextComposer } from "./VoiceTextComposer";

it("opens in voice mode and switches to editable text mode", async () => {
  const user = userEvent.setup();

  render(<VoiceTextComposer onTranscribe={vi.fn()} onSubmit={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Увімкнути текстовий режим" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Увімкнути текстовий режим" }));

  expect(screen.getByRole("textbox")).toBeInTheDocument();
});

it("does not submit an empty draft and submits edited transcript text", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();

  render(<VoiceTextComposer initialMode="text" onTranscribe={vi.fn()} onSubmit={onSubmit} />);

  const input = screen.getByRole("textbox");
  await user.click(screen.getByRole("button", { name: "Відправити" }));
  expect(onSubmit).not.toHaveBeenCalled();

  await user.type(input, "Моя відредагована відповідь");
  await user.click(screen.getByRole("button", { name: "Відправити" }));

  expect(onSubmit).toHaveBeenCalledWith("Моя відредагована відповідь");
});
