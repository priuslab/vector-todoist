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

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.test/tasks",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer pb-token",
          "X-Request-Id": "request-123",
          "X-Trace": "trace",
        }),
      }),
    );
    expect(fetchImpl.mock.calls[0][1].headers["X-User-Id"]).toBeUndefined();
    expect(fetchImpl.mock.calls[0][1].headers.UserId).toBeUndefined();
    expect(fetchImpl.mock.calls[0][1].headers["X-Caller-Id"]).toBeUndefined();
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
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe("Bearer fresh-token");
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
