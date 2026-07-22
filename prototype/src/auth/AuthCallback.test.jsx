import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AuthCallback } from "./AuthCallback";

it("keeps PocketBase callback errors out of the Ukrainian UI", async () => {
  window.history.pushState({}, "", "/auth/callback?code=code&state=expected");
  window.sessionStorage.setItem("google_oauth_state", "expected");
  window.sessionStorage.setItem("google_pkce_verifier", "verifier");
  const authWithOAuth2Code = vi.fn().mockRejectedValue(new Error("PocketBase internal failure"));
  const errorLogger = vi.spyOn(console, "error").mockImplementation(() => {});

  render(<AuthCallback pb={{ collection: () => ({ authWithOAuth2Code }) }} />);

  expect(await screen.findByRole("heading", { name: "Не вдалося увійти" })).toBeInTheDocument();
  expect(screen.getByText("Не вдалося завершити вхід. Твої дані не змінено — спробуй ще раз.")).toBeInTheDocument();
  expect(screen.queryByText("PocketBase internal failure")).not.toBeInTheDocument();
  errorLogger.mockRestore();
  window.history.pushState({}, "", "/");
});
