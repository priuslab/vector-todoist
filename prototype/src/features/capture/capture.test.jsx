import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CaptureFlow } from "./CaptureFlow";

it("opens the Brain Dump chooser in voice mode", () => {
  render(<CaptureFlow />);

  expect(screen.getByRole("button", { name: "Почати запис" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Увімкнути текстовий режим" })).toBeInTheDocument();
});

it("exposes text entry when microphone access is denied", async () => {
  const user = userEvent.setup();
  const originalMediaRecorder = globalThis.MediaRecorder;
  const originalMediaDevices = navigator.mediaDevices;
  globalThis.MediaRecorder = class FakeMediaRecorder {
    static isTypeSupported = () => true;
  };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) },
  });

  try {
    render(<CaptureFlow />);

    await user.click(screen.getByRole("button", { name: "Почати запис" }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Твоя думка" })).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("мікрофона");
  } finally {
    globalThis.MediaRecorder = originalMediaRecorder;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
  }
});

it("asks a critical question after processing when confidence is low", async () => {
  render(<CaptureFlow screenId="capture-processing" processingDelayMs={10} />);

  await waitFor(() => expect(screen.getByText("Коли має бути готова структура першого епізоду?")).toBeInTheDocument());
});
