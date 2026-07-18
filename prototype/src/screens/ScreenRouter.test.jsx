import { act, render, screen, waitFor } from "@testing-library/react";
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

it("starts a pending OAuth callback exchange only once across parent rerenders", async () => {
  window.history.pushState({}, "", "/auth/callback?code=code&state=expected");
  window.sessionStorage.setItem("google_oauth_state", "expected");
  window.sessionStorage.setItem("google_pkce_verifier", "verifier");
  let resolveExchange;
  const authWithOAuth2Code = vi.fn(() => new Promise((resolve) => { resolveExchange = resolve; }));
  const onNavigate = vi.fn();
  const props = { route: "auth-callback", onNavigate, pocketBase: { collection: () => ({ authWithOAuth2Code }) } };
  const view = render(<ScreenRouter {...props} />);

  await waitFor(() => expect(authWithOAuth2Code).toHaveBeenCalledTimes(1));
  view.rerender(<ScreenRouter {...props} />);
  await act(async () => { await Promise.resolve(); });

  expect(authWithOAuth2Code).toHaveBeenCalledTimes(1);
  await act(async () => { resolveExchange({ token: "pb-token" }); });
  window.history.pushState({}, "", "/");
});
