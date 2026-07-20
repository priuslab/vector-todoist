import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CaptureFlow } from "./CaptureFlow";

function installFakeMediaRecorder() {
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });

  class FakeMediaRecorder {
    static isTypeSupported = () => true;
    state = "inactive";
    mimeType = "audio/webm";

    start() { this.state = "recording"; }
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

it("persists text through the injected capture API and confirms a draft", async () => {
  const user = userEvent.setup();
  const createBrainDump = vi.fn(async () => ({ id: "dump-1", status: "draft", rawText: "Моя думка" }));
  render(<CaptureFlow createBrainDump={createBrainDump} />);
  await user.click(screen.getByRole("button", { name: "Увімкнути текстовий режим" }));
  const textarea = screen.getByRole("textbox", { name: "Твоя думка" });
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
  await user.click(screen.getByRole("button", { name: "Увімкнути текстовий режим" }));
  const textarea = screen.getByRole("textbox", { name: "Твоя думка" });
  await user.clear(textarea); await user.type(textarea, "Залиш цю думку");
  await user.click(screen.getByRole("button", { name: "Зберегти чернетку" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося зберегти");
  expect(screen.getByDisplayValue("Залиш цю думку")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Зберегти чернетку" })).toBeInTheDocument();
});

it("saves the edited voice transcript through the existing Brain Dump callback", async () => {
  const user = userEvent.setup();
  const restoreMediaRecorder = installFakeMediaRecorder();
  const createBrainDump = vi.fn(async () => ({ id: "dump-voice", status: "draft" }));
  const apiClient = { request: vi.fn(async () => ({ transcript: "Початкова транскрипція" })) };
  const completedAnalysis = { summary: "Готово", confidence: 0.9, tasks: [], ideas: [], context: [], questions: [] };

  try {
    render(
      <CaptureFlow
        apiClient={apiClient}
        createBrainDump={createBrainDump}
        analyze={vi.fn(async () => ({ analysis: completedAnalysis }))}
        fetchResult={vi.fn(async () => ({ analysis: completedAnalysis }))}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Почати запис" }));
    await user.click(screen.getByRole("button", { name: "Завершити запис" }));

    const transcript = await screen.findByRole("textbox", { name: "Редагувати транскрипт" });
    await user.clear(transcript);
    await user.type(transcript, "Відредагована транскрипція");
    await user.click(screen.getByRole("button", { name: "Зберегти чернетку" }));

    await waitFor(() => expect(createBrainDump).toHaveBeenCalledWith(expect.objectContaining({ text: "Відредагована транскрипція" })));
    expect(apiClient.request).toHaveBeenCalledWith("/api/v1/brain-dumps/voice", expect.objectContaining({ method: "POST" }));
  } finally {
    restoreMediaRecorder();
  }
});

it("submits one retry while voice transcription is pending", async () => {
  const user = userEvent.setup();
  const restoreMediaRecorder = installFakeMediaRecorder();
  const firstAttempt = deferred();
  const retryAttempt = deferred();
  const apiClient = {
    request: vi.fn()
      .mockImplementationOnce(() => firstAttempt.promise)
      .mockImplementationOnce(() => retryAttempt.promise),
  };

  try {
    render(<CaptureFlow apiClient={apiClient} />);

    await user.click(screen.getByRole("button", { name: "Почати запис" }));
    await user.click(screen.getByRole("button", { name: "Завершити запис" }));
    await waitFor(() => expect(apiClient.request).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Почати запис" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Увімкнути текстовий режим" })).toBeDisabled();

    firstAttempt.reject(new Error("offline"));
    await screen.findByRole("button", { name: "Спробувати ще раз" });
    apiClient.request.mockClear();

    const retry = screen.getByRole("button", { name: "Спробувати ще раз" });
    await user.click(retry);
    await waitFor(() => expect(retry).toBeDisabled());
    await user.click(retry);

    expect(apiClient.request).toHaveBeenCalledTimes(1);
    retryAttempt.resolve({ transcript: "Повторна транскрипція" });
  } finally {
    restoreMediaRecorder();
  }
});
