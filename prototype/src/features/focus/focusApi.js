export function previewFocus({ apiClient, mode = "balanced", goalId, profile, busySlots = [], now, timezone, idempotencyKey }) {
  return apiClient.request('/api/v1/focus/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, ...(goalId ? { goalId } : {}), profile, busySlots, now, timezone, idempotencyKey }) });
}
export function applyFocus({ apiClient, mode = "balanced", goalId, profile, busySlots = [], now, timezone, idempotencyKey }) {
  return apiClient.request('/api/v1/focus/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, ...(goalId ? { goalId } : {}), profile, busySlots, now, timezone, idempotencyKey }) });
}
