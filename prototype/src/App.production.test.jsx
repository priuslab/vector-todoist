import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "./App";

const productionEnv = { DEV: false, MODE: "production", VITE_POCKETBASE_URL: "https://pb.example.test" };

function pocketBaseAfterGoogle(onboardingCompleted) {
  const listeners = new Set();
  const authStore = {
    token: "",
    record: null,
    onChange(listener, immediate) { listeners.add(listener); if (immediate) listener(this.token, this.record); return () => listeners.delete(listener); },
    emit(token, record) { this.token = token; this.record = record; listeners.forEach((listener) => listener(token, record)); },
  };
  const authWithOAuth2Code = vi.fn(async () => {
    authStore.emit("pb-token", { id: "olena", onboardingCompleted });
    return { token: "pb-token" };
  });
  return { authStore, collection: () => ({ authWithOAuth2Code }), authWithOAuth2Code };
}

function beginCallback() {
  window.history.replaceState({}, "", "/auth/callback?code=code&state=expected");
  window.sessionStorage.setItem("google_oauth_state", "expected");
  window.sessionStorage.setItem("google_pkce_verifier", "verifier");
}

it.each([
  [false, "Налаштуй Вектор під свій ритм"],
  [true, "Спокійний план на день"],
])("canonicalizes OAuth success and restores the persisted route for onboarding=%s", async (onboardingCompleted, heading) => {
  beginCallback();
  const pocketBase = pocketBaseAfterGoogle(onboardingCompleted);
  const view = render(<App env={productionEnv} pocketBase={pocketBase} />);

  expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/");
  expect(pocketBase.authWithOAuth2Code).toHaveBeenCalledTimes(1);

  view.unmount();
  render(<App env={productionEnv} pocketBase={pocketBase} />);
  expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  expect(pocketBase.authWithOAuth2Code).toHaveBeenCalledTimes(1);
});

it("shows a stable Ukrainian configuration error instead of a production localhost fallback", () => {
  render(<App env={{ DEV: false, MODE: "production" }} />);

  expect(screen.getByRole("heading", { name: "Потрібно налаштувати підключення" })).toBeInTheDocument();
  expect(screen.queryByText("127.0.0.1")).not.toBeInTheDocument();
});
