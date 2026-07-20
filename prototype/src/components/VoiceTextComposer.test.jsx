import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { VoiceTextComposer } from "./VoiceTextComposer";

function installFakeMediaRecorder() {
  const stopTrack = vi.fn();
  const getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: stopTrack }],
  });
  let recorder;

  class FakeMediaRecorder {
    static isTypeSupported = () => true;
    state = "inactive";
    mimeType = "audio/webm";

    start() {
      this.state = "recording";
      recorder = this;
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

  return {
    emitError() {
      recorder?.onerror?.(new Event("error"));
    },
    stopTrack,
    restore() {
      globalThis.MediaRecorder = originalMediaRecorder;
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
    },
  };
}

it("opens in voice mode and switches to editable text mode", async () => {
  const user = userEvent.setup();

  render(<VoiceTextComposer onTranscribe={vi.fn()} onSubmit={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Увімкнути текстовий режим" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Увімкнути текстовий режим" }));

  expect(screen.getByRole("textbox")).toBeInTheDocument();
});

it("disables submit for an empty draft and enables it after editing", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();

  render(<VoiceTextComposer initialMode="text" onTranscribe={vi.fn()} onSubmit={onSubmit} />);

  const input = screen.getByRole("textbox");
  const submit = screen.getByRole("button", { name: "Відправити" });
  expect(submit).toBeDisabled();
  await user.click(submit);
  expect(onSubmit).not.toHaveBeenCalled();

  await user.type(input, "Моя відредагована відповідь");
  expect(submit).toBeEnabled();
  await user.click(submit);

  expect(onSubmit).toHaveBeenCalledWith("Моя відредагована відповідь");
});

it("uses a host submit label and disables text composer controls while submission is pending", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();

  render(
    <VoiceTextComposer
      initialMode="text"
      submitLabel="Відповісти"
      disabled
      onTranscribe={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  await user.type(screen.getByRole("textbox"), "Моя відповідь");
  const submit = screen.getByRole("button", { name: "Відповісти" });

  expect(screen.getByRole("textbox")).toBeDisabled();
  expect(submit).toBeDisabled();
  expect(screen.getByRole("button", { name: "Увімкнути голосовий режим" })).toBeDisabled();
  await user.click(submit);
  expect(onSubmit).not.toHaveBeenCalled();
});

it("uses the mobile composer control classes", () => {
  render(<VoiceTextComposer initialMode="text" onTranscribe={vi.fn()} onSubmit={vi.fn()} />);

  expect(screen.getByRole("textbox")).toHaveClass("voice-text-composer__draft");
  expect(screen.getByRole("button", { name: "Відправити" })).toHaveClass("voice-text-composer__submit");
  expect(screen.getByRole("button", { name: "Увімкнути голосовий режим" })).toHaveClass("voice-text-composer__mode-switch");
});

it("gives the microphone control a mobile touch-target class", () => {
  render(<VoiceTextComposer onTranscribe={vi.fn()} onSubmit={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Почати запис" })).toHaveClass("voice-text-composer__microphone");
});

it("renders a status-specific AI surface and a response playback action", () => {
  const onSpeak = vi.fn();

  render(
    <VoiceTextComposer
      status="responding"
      responseText="Готово"
      onTranscribe={vi.fn()}
      onSubmit={vi.fn()}
      onSpeak={onSpeak}
    />,
  );

  expect(screen.getByTestId("ai-orb")).toHaveClass("is-responding");
  expect(screen.getByText("Готово")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Прослухати відповідь" }));

  expect(onSpeak).toHaveBeenCalledWith("Готово");
});

it("starts and stops recording with the same microphone control", async () => {
  const user = userEvent.setup();
  const onTranscribe = vi.fn().mockResolvedValue("Розпізнаний текст");
  const fakeMediaRecorder = installFakeMediaRecorder();

  try {
    render(<VoiceTextComposer onTranscribe={onTranscribe} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Почати запис" }));
    expect(screen.getByRole("status")).toHaveTextContent("Слухаю");

    await user.click(screen.getByRole("button", { name: "Завершити запис" }));
    await waitFor(() => expect(onTranscribe).toHaveBeenCalledWith(expect.any(Blob)));

    expect(screen.getByRole("textbox")).toHaveValue("Розпізнаний текст");
  } finally {
    fakeMediaRecorder.restore();
  }
});

it("falls back to text mode when microphone access is denied", async () => {
  const user = userEvent.setup();
  const fakeMediaRecorder = installFakeMediaRecorder();
  const originalMediaDevices = navigator.mediaDevices;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(() => new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException("denied", "NotAllowedError")), 50);
      })),
    },
  });

  try {
    render(<VoiceTextComposer onTranscribe={vi.fn()} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Почати запис" }));

    const input = await screen.findByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("мікрофон");
    expect(screen.getByRole("status")).toHaveTextContent("Потрібна твоя увага");
    expect(screen.getByTestId("ai-orb")).toHaveClass("is-error");
  } finally {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
    fakeMediaRecorder.restore();
  }
});

it("keeps the error state while transcription falls back to editable text", async () => {
  const user = userEvent.setup();
  const fakeMediaRecorder = installFakeMediaRecorder();

  try {
    render(<VoiceTextComposer onTranscribe={vi.fn().mockRejectedValue(new Error("transcription failed"))} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Почати запис" }));
    await user.click(screen.getByRole("button", { name: "Завершити запис" }));

    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("розпізнати");
    expect(screen.getByRole("status")).toHaveTextContent("Потрібна твоя увага");
    expect(screen.getByTestId("ai-orb")).toHaveClass("is-error");
  } finally {
    fakeMediaRecorder.restore();
  }
});

it("keeps the voice controls disabled while microphone access is pending", async () => {
  const user = userEvent.setup();
  const fakeMediaRecorder = installFakeMediaRecorder();
  let resolveMicrophone;
  const originalMediaDevices = navigator.mediaDevices;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(() => new Promise((resolve) => { resolveMicrophone = resolve; })) },
  });

  try {
    render(<VoiceTextComposer onTranscribe={vi.fn()} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Почати запис" }));

    expect(screen.getByRole("button", { name: "Почати запис" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Увімкнути текстовий режим" })).toBeDisabled();
  } finally {
    resolveMicrophone?.({ getTracks: () => [{ stop: vi.fn() }] });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
    fakeMediaRecorder.restore();
  }
});

it("changes an error fallback to a draft only after the user edits it", async () => {
  const user = userEvent.setup();
  const fakeMediaRecorder = installFakeMediaRecorder();
  const originalMediaDevices = navigator.mediaDevices;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) },
  });

  try {
    render(<VoiceTextComposer onTranscribe={vi.fn()} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Почати запис" }));

    const input = await screen.findByRole("textbox");
    expect(screen.getByTestId("ai-orb")).toHaveClass("is-error");
    await user.type(input, "Запишу це текстом");

    expect(screen.getByRole("status")).toHaveTextContent("Чернетка готова");
    expect(screen.getByTestId("ai-orb")).toHaveClass("is-draft");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  } finally {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
    fakeMediaRecorder.restore();
  }
});

it("falls back to editable text when MediaRecorder emits a runtime error", async () => {
  const user = userEvent.setup();
  const fakeMediaRecorder = installFakeMediaRecorder();

  try {
    render(<VoiceTextComposer onTranscribe={vi.fn()} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Почати запис" }));
    fakeMediaRecorder.emitError();

    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("мікрофон");
    expect(fakeMediaRecorder.stopTrack).toHaveBeenCalledTimes(1);
  } finally {
    fakeMediaRecorder.restore();
  }
});
