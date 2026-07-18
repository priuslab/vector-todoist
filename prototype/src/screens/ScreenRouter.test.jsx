import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SCREEN_REGISTRY } from "./screenRegistry";
import { ScreenRouter } from "./ScreenRouter";

it("renders every registered prototype state without crashing", () => {
  for (const screen of SCREEN_REGISTRY) {
    const view = render(<ScreenRouter route={screen.id} onNavigate={() => {}} />);
    expect(view.container.firstChild, screen.id).toBeTruthy();
    view.unmount();
  }
});

it("shows a stable Ukrainian error when Google login cannot start", async () => {
  const user = userEvent.setup();
  const errorLogger = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<ScreenRouter route="entry-chaos" onNavigate={vi.fn()} onGoogleLogin={vi.fn().mockRejectedValue(new Error("missing Google client id"))} />);

  await user.click(screen.getByRole("button", { name: "Продовжити з Google" }));

  expect(await screen.findByRole("heading", { name: "Не вдалося увійти" })).toBeInTheDocument();
  expect(screen.queryByText("missing Google client id")).not.toBeInTheDocument();
  errorLogger.mockRestore();
});
