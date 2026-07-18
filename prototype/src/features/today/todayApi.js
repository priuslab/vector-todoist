export function previewBrainDumpPlan({ apiClient, id, profile, busySlots = [], now, timezone, idempotencyKey }) {
  return apiClient.request(`/api/v1/brain-dumps/${encodeURIComponent(id)}/plan-preview`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body: JSON.stringify({ profile, busySlots, now, timezone, idempotencyKey }) });
}
export function applyChangeSet({ apiClient, id, idempotencyKey }) {
  return apiClient.request(`/api/v1/change-sets/${encodeURIComponent(id)}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey }) });
}
export function getToday({ apiClient, date, timezone }) { return apiClient.request(`/api/v1/today?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(timezone)}`); }
export function getInbox({ apiClient }) { return apiClient.request('/api/v1/inbox'); }
export function getTask({ apiClient, id }) { return apiClient.request(`/api/v1/tasks/${encodeURIComponent(id)}`); }
