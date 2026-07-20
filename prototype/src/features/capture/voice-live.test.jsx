import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { VoiceRecorder } from "./VoiceRecorder";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";

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

it("cancelling an active recorder discards chunks without completing", async () => {
  const onComplete = vi.fn();
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }));
  const previousMedia = globalThis.MediaRecorder;
  const previousDevices = navigator.mediaDevices;
  class FakeMediaRecorder {
    static isTypeSupported = () => true;
    state = "inactive";
    mimeType = "audio/webm";
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["secret"]) }); this.onstop?.(); }
  }
  globalThis.MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  function Harness() { const recorder = useVoiceRecorder({ onComplete }); return <><button onClick={recorder.start}>start</button><button onClick={recorder.cancel}>cancel</button></>; }
  const user = userEvent.setup(); render(<Harness />);
  await user.click(screen.getByRole("button", { name: "start" })); await user.click(screen.getByRole("button", { name: "cancel" }));
  expect(onComplete).not.toHaveBeenCalled();
  globalThis.MediaRecorder = previousMedia; Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: previousDevices });
});

it("guards a pending microphone request and releases a stream that resolves after cancellation", async () => {
  let resolveMicrophone;
  const stopTrack = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] };
  const getUserMedia = vi.fn(() => new Promise((resolve) => { resolveMicrophone = resolve; }));
  const previousMedia = globalThis.MediaRecorder;
  const previousDevices = navigator.mediaDevices;
  const recorderStart = vi.fn();

  class FakeMediaRecorder {
    static isTypeSupported = () => true;
    state = "inactive";
    constructor() { this.start = recorderStart; }
  }

  globalThis.MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  function Harness() {
    const recorder = useVoiceRecorder({ onComplete: vi.fn() });
    return <><button onClick={recorder.start}>start</button><button onClick={recorder.cancel}>cancel</button></>;
  }

  try {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    fireEvent.click(screen.getByRole("button", { name: "start" }));

    expect(getUserMedia).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    resolveMicrophone(stream);

    await waitFor(() => expect(stopTrack).toHaveBeenCalledTimes(1));
    expect(recorderStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  } finally {
    globalThis.MediaRecorder = previousMedia;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: previousDevices });
  }
});
