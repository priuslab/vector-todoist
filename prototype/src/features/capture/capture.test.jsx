import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { CaptureFlow } from "./CaptureFlow";

it("moves from voice capture to AI processing", async () => {
  const user = userEvent.setup();
  render(<CaptureFlow />);

  await user.click(screen.getByRole("button", { name: "Диктувати" }));
  await user.click(screen.getByRole("button", { name: "Завершити запис" }));

  expect(screen.getByText("Розпізнаю думки")).toBeInTheDocument();
});

it("asks a critical question after processing when confidence is low", async () => {
  render(<CaptureFlow screenId="capture-processing" processingDelayMs={10} />);

  await waitFor(() => expect(screen.getByText("Коли має бути готова структура першого епізоду?")).toBeInTheDocument());
});
