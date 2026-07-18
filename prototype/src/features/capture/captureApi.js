export async function createTextBrainDump({ apiClient, text, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", idempotencyKey }) {
  if (!apiClient?.request) throw new Error("API client is not configured");
  return apiClient.request("/api/v1/brain-dumps", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey ?? crypto.randomUUID() },
    body: JSON.stringify({ kind: "text", text, timezone }),
  });
}
