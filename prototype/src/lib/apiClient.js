import { ApiError } from "./apiError";

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function trustedHeaders(headers, token, id) {
  const normalizedHeaders = new Headers(headers);
  for (const name of [...normalizedHeaders.keys()]) {
    const normalized = name.toLowerCase().replaceAll("_", "").replaceAll("-", "");
    if (normalized === "authorization" || normalized.includes("userid") || normalized.includes("callerid")) {
      normalizedHeaders.delete(name);
    }
  }
  normalizedHeaders.set("X-Request-Id", id);
  if (token) normalizedHeaders.set("Authorization", `Bearer ${token}`);
  return normalizedHeaders;
}

async function asApiError(response) {
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  return new ApiError({
    status: response.status,
    message: payload?.message ?? payload?.error ?? "Не вдалося виконати запит. Спробуй ще раз.",
    details: payload,
  });
}

export function createApiClient({ baseUrl, fetchImpl = globalThis.fetch, getToken, refreshToken, onAuthExpired, requestIdFactory = requestId }) {
  async function send(path, options, token, id) {
    const headers = trustedHeaders(options.headers, token, id);
    return fetchImpl(new URL(path, baseUrl).toString(), { ...options, headers });
  }

  return {
    async request(path, options = {}) {
      const id = requestIdFactory();
      let response = await send(path, options, getToken?.(), id);
      if (response.status === 401) {
        const token = await refreshToken?.();
        if (!token) {
          onAuthExpired?.();
          throw await asApiError(response);
        }
        response = await send(path, options, token, id);
        if (response.status === 401) onAuthExpired?.();
      }
      if (!response.ok) throw await asApiError(response);
      if (response.status === 204) return undefined;
      return response.json();
    },
  };
}
