import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createAuthStore, createPocketBaseClient, useAuthState } from "./authStore";

function pocketBaseWith(record = null, token = "") {
  const listeners = new Set();
  return {
    authStore: {
      record,
      token,
      clear: vi.fn(function clear() { this.record = null; this.token = ""; listeners.forEach((listener) => listener(this.token, this.record)); }),
      onChange: vi.fn(function onChange(listener, fireImmediately) { listeners.add(listener); if (fireImmediately) listener(this.token, this.record); return () => listeners.delete(listener); }),
      emit(nextToken, nextRecord) { this.token = nextToken; this.record = nextRecord; listeners.forEach((listener) => listener(nextToken, nextRecord)); },
    },
  };
}

describe("auth store", () => {
  it("allows a localhost PocketBase fallback only in development or test", () => {
    expect(createPocketBaseClient({ env: { DEV: true } }).baseUrl).toBe("http://127.0.0.1:8090");
    expect(() => createPocketBaseClient({ env: { DEV: false, MODE: "production" } })).toThrow("PocketBase");
  });

  it("subscribes to PocketBase persistence and exposes authenticated, anonymous, and expired states", () => {
    const pb = pocketBaseWith();
    const store = createAuthStore(pb);
    expect(store.getSnapshot().status).toBe("loading");
    const { result, unmount } = renderHook(() => useAuthState(store));

    expect(result.current.status).toBe("anonymous");
    act(() => pb.authStore.emit("token", { id: "olena", onboardingCompleted: false }));
    expect(result.current).toMatchObject({ status: "authenticated", record: { id: "olena" } });
    act(() => store.markExpired());
    expect(result.current.status).toBe("expired");
    expect(pb.authStore.clear).toHaveBeenCalledTimes(1);
    unmount();
    expect(pb.authStore.onChange.mock.results[0].value).toBeTypeOf("function");
  });
});
