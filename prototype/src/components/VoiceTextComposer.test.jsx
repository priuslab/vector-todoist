import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { VoiceTextComposer } from "./VoiceTextComposer";

function installFakeMediaRecorder() {
  const getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  });

  class FakeMediaRecorder {
    static isTypeSupported = () => true;
    state = "inactive";
    mimeType = "audio/webm";

    start() {
      this.state = "recording";
    }

    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["recording"], { type: this.mimeType }) });
      this.onstop?.();
    }
  }

  const originalMediaRecorder = globalThis.MediaRecorder;
  const originalMediaDevices = navigator.mediaDevices;
  globalThis.MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });

  return () => {
    globalThis.MediaRecorder = originalMediaRecorder;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
  };
}

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

it("uses the mobile composer control classes", () => {
  render(<VoiceTextComposer initialMode="text" onTranscribe={vi.fn()} onSubmit={vi.fn()} />);

  expect(screen.getByRole("textbox")).toHaveClass("voice-text-composer__draft");
  expect(screen.getByRole("button", { name: "Відправити" })).toHaveClass("voice-text-composer__submit");
  expect(screen.getByRole("button", { name: "Увімкнути голосовий режим" })).toHaveClass("voice-text-composer__mode-switch");
});

it("starts and stops recording with the same microphone control", async () => {
  const user = userEvent.setup();
  const onTranscribe = vi.fn().mockResolvedValue("Розпізнаний текст");
  const restoreMediaRecorder = installFakeMediaRecorder();

  try {
    render(<VoiceTextComposer onTranscribe={onTranscribe} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Почати запис" }));
    expect(screen.getByRole("status")).toHaveTextContent("Слухаю");

    await user.click(screen.getByRole("button", { name: "Завершити запис" }));
    await waitFor(() => expect(onTranscribe).toHaveBeenCalledWith(expect.any(Blob)));

    expect(screen.getByRole("textbox")).toHaveValue("Розпізнаний текст");
  } finally {
    restoreMediaRecorder();
  }
});

it("falls back to text mode when microphone access is denied", async () => {
  const user = userEvent.setup();
  const restoreMediaRecorder = installFakeMediaRecorder();
  const originalMediaDevices = navigator.mediaDevices;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) },
  });

  try {
    render(<VoiceTextComposer onTranscribe={vi.fn()} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Почати запис" }));

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("мікрофон");
  } finally {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
    restoreMediaRecorder();
  }
});
