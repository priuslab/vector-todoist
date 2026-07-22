import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./apiError";
import { createApiClient } from "./apiClient";

const ok = (body = { ok: true }) => new Response(JSON.stringify(body), { status: 200 });

describe("createApiClient", () => {
  it("adds the auth token and request id without forwarding a caller supplied user id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ task: "ok" }));
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
      getToken: () => "pb-token",
      requestIdFactory: () => "request-123",
    });

    await client.request("/tasks", { headers: { "X-User-Id": "attacker", "UserId": "attacker", "X-Caller-Id": "attacker", "X-Trace": "trace" } });

    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.example.test/tasks");
    const headers = fetchImpl.mock.calls[0][1].headers;
    expect(headers.get("Authorization")).toBe("Bearer pb-token");
    expect(headers.get("X-Request-Id")).toBe("request-123");
    expect(headers.get("X-Trace")).toBe("trace");
    expect(headers.get("X-User-Id")).toBeNull();
    expect(headers.get("UserId")).toBeNull();
    expect(headers.get("X-Caller-Id")).toBeNull();
  });

  it("discards caller-supplied Authorization when no trusted token is available", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
      getToken: () => null,
      requestIdFactory: () => "request-123",
    });

    await client.request("/tasks", { headers: { Authorization: "Bearer attacker" } });

    expect(fetchImpl.mock.calls[0][1].headers.get("Authorization")).toBeNull();
  });

  it("normalizes Headers and keeps only trusted request headers", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const client = createApiClient({ baseUrl: "https://api.example.test", fetchImpl, getToken: () => "pb-token", requestIdFactory: () => "request-123" });

    await client.request("/tasks", { headers: new Headers([["X-Trace", "trace"], ["Authorization", "Bearer attacker"], ["X-User-Id", "attacker"]]) });

    const headers = fetchImpl.mock.calls[0][1].headers;
    expect(headers).toBeInstanceOf(Headers);
    expect(headers.get("X-Trace")).toBe("trace");
    expect(headers.get("Authorization")).toBe("Bearer pb-token");
    expect(headers.get("X-User-Id")).toBeNull();
  });

  it("preserves tuple-array headers after normalizing HeadersInit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const client = createApiClient({ baseUrl: "https://api.example.test", fetchImpl, getToken: () => null, requestIdFactory: () => "request-123" });

    await client.request("/tasks", { headers: [["X-Trace", "trace"], ["X-Caller-Id", "attacker"]] });

    const headers = fetchImpl.mock.calls[0][1].headers;
    expect(headers).toBeInstanceOf(Headers);
    expect(headers.get("X-Trace")).toBe("trace");
    expect(headers.get("X-Caller-Id")).toBeNull();
  });

  it("turns non-success responses into an ApiError", async () => {
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Немає доступу" }), { status: 403 })),
      getToken: () => "pb-token",
      requestIdFactory: () => "request-123",
    });

    await expect(client.request("/tasks")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "Немає доступу",
    });
    await expect(client.request("/tasks")).rejects.toBeInstanceOf(ApiError);
  });

  it("refreshes once and retries a 401 request with the new token", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(ok({ task: "ok" }));
    const refreshToken = vi.fn().mockResolvedValue("fresh-token");
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
      getToken: () => "stale-token",
      refreshToken,
      requestIdFactory: () => "request-123",
    });

    await expect(client.request("/tasks")).resolves.toEqual({ task: "ok" });
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][1].headers.get("Authorization")).toBe("Bearer fresh-token");
    expect(fetchImpl.mock.calls[1][1].headers.get("X-Request-Id")).toBe(fetchImpl.mock.calls[0][1].headers.get("X-Request-Id"));
  });

  it("expires auth after one failed refresh and does not retry other errors", async () => {
    const expired = vi.fn();
    const refreshToken = vi.fn().mockResolvedValue(null);
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: vi.fn().mockResolvedValue(new Response("", { status: 401 })),
      getToken: () => "stale-token",
      refreshToken,
      onAuthExpired: expired,
      requestIdFactory: () => "request-123",
    });

    await expect(client.request("/tasks")).rejects.toMatchObject({ status: 401 });
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledTimes(1);
  });
});
