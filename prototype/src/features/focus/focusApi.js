export function previewFocus({ apiClient, mode = "balanced", goalId, profile, busySlots = [], now, timezone, idempotencyKey }) {
  return apiClient.request('/api/v1/focus/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, ...(goalId ? { goalId } : {}), profile, busySlots, now, timezone, idempotencyKey }) });
}
export function applyFocus({ apiClient, mode = "balanced", goalId, profile, busySlots = [], now, timezone, idempotencyKey }) {
  return apiClient.request('/api/v1/focus/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, ...(goalId ? { goalId } : {}), profile, busySlots, now, timezone, idempotencyKey }) });
}

export function startFocusSession({ apiClient, taskId, durationMinutes = 50, idempotencyKey }) {
  return apiClient.request('/api/v1/focus-sessions/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, durationMinutes, ...(idempotencyKey ? { idempotencyKey } : {}) }) });
}
export function pauseFocusSession({ apiClient, sessionId }) { return apiClient.request(`/api/v1/focus-sessions/${sessionId}/pause`, { method: 'POST' }); }
export function resumeFocusSession({ apiClient, sessionId }) { return apiClient.request(`/api/v1/focus-sessions/${sessionId}/resume`, { method: 'POST' }); }
export function finishFocusSession({ apiClient, sessionId, completeTask = false }) { return apiClient.request(`/api/v1/focus-sessions/${sessionId}/finish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completeTask }) }); }
