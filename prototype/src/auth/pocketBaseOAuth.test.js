import { describe, expect, it, vi } from "vitest";
import { completeGoogleLogin, startGoogleLogin } from "./pocketBaseOAuth";

describe("Google PKCE", () => {
  it("uses a single-use state and only identity scopes before redirecting", async () => {
    const location = { origin: "https://vector.example", assign: vi.fn() };
    const storage = new Map();
    const sessionStorage = { setItem: (key, value) => storage.set(key, value), getItem: (key) => storage.get(key), removeItem: (key) => storage.delete(key) };

    await startGoogleLogin({ clientId: "google-client", location, sessionStorage, randomBytes: () => new Uint8Array(32).fill(7) });

    const target = new URL(location.assign.mock.calls[0][0]);
    expect(target.searchParams.get("scope")).toBe("openid email profile");
    expect(target.searchParams.get("state")).toBeTruthy();
    expect(storage.get("google_oauth_state")).toBe(target.searchParams.get("state"));
  });

  it("rejects a mismatched callback state and clears one-time session values", async () => {
    const removeItem = vi.fn();
    const sessionStorage = { getItem: vi.fn((key) => key === "google_oauth_state" ? "expected" : "verifier"), removeItem };
    const pb = { collection: vi.fn() };

    await expect(completeGoogleLogin({ pb, location: { origin: "https://vector.example", search: "?code=code&state=wrong" }, sessionStorage })).rejects.toThrow("Стан входу");
    expect(removeItem).toHaveBeenCalledWith("google_oauth_state");
    expect(removeItem).toHaveBeenCalledWith("google_pkce_verifier");
  });

  it("exchanges a verified callback code with PocketBase's manual OAuth method", async () => {
    const authWithOAuth2Code = vi.fn().mockResolvedValue({ token: "pb-token" });
    const sessionStorage = {
      getItem: vi.fn((key) => key === "google_oauth_state" ? "expected" : "verifier"),
      removeItem: vi.fn(),
    };
    const pb = { collection: vi.fn(() => ({ authWithOAuth2Code })) };

    await expect(completeGoogleLogin({ pb, location: { origin: "https://vector.example", search: "?code=google-code&state=expected" }, sessionStorage })).resolves.toEqual({ token: "pb-token" });
    expect(authWithOAuth2Code).toHaveBeenCalledWith("google", "google-code", "verifier", "https://vector.example/auth/callback");
  });
});
