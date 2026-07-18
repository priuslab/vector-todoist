import { ApiError } from "./apiError";

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function withoutCallerIdentity(headers) {
  return Object.fromEntries(Object.entries(headers ?? {}).filter(([name]) => {
    const normalized = name.toLowerCase().replaceAll("_", "").replaceAll("-", "");
    return !normalized.includes("userid") && !normalized.includes("callerid");
  }));
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
  async function send(path, options, token) {
    const headers = {
      ...withoutCallerIdentity(options.headers),
      "X-Request-Id": requestIdFactory(),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchImpl(new URL(path, baseUrl).toString(), { ...options, headers });
  }

  return {
    async request(path, options = {}) {
      let response = await send(path, options, getToken?.());
      if (response.status === 401) {
        const token = await refreshToken?.();
        if (!token) {
          onAuthExpired?.();
          throw await asApiError(response);
        }
        response = await send(path, options, token);
        if (response.status === 401) onAuthExpired?.();
      }
      if (!response.ok) throw await asApiError(response);
      if (response.status === 204) return undefined;
      return response.json();
    },
  };
}
