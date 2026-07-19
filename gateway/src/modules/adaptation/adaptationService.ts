import type { PocketBaseClient, PocketBaseRecord } from '../../pocketbase/client.js';
import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';

export type AdaptationSuggestion = { id: string; kind: 'duration' | 'window' | 'reschedule'; status: 'proposed' | 'accepted' | 'rejected'; title: string; detail: string; adjustment: Record<string, unknown> };
export type AdaptationMetrics = { sampleSize: number; byCategory: Record<string, { sampleSize: number; multiplier: number }>; byEnergy: Record<string, { sampleSize: number; multiplier: number }>; preferredWindows: Array<{ start: number; end: number; sampleSize: number }>; rescheduleRate: number };
export type AdaptationRecord = PocketBaseRecord & { user: string; consent: boolean; metricsJson?: unknown; suggestionsJson?: unknown; updatedAt: string };
export type ExecutionSession = PocketBaseRecord & { status?: string; plannedMinutes?: number; actualMinutes?: number | null; finishedAt?: string | null; taskId?: string; category?: string; energy?: string; reschedules?: number };

export interface AdaptationRepository { get(user: VerifiedUser): Promise<AdaptationRecord | null>; save(user: VerifiedUser, input: Record<string, unknown>): Promise<AdaptationRecord>; listSessions(user: VerifiedUser): Promise<ExecutionSession[]>; }
const esc = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
export function createAdaptationRepository(client: PocketBaseClient): AdaptationRepository {
  const scoped = (user: VerifiedUser) => user.token && client.withToken ? client.withToken(user.token) : client;
  return {
    get: async (user) => (await scoped(user).list<AdaptationRecord>('adaptation_metrics', `user = '${esc(user.userId)}'`)).find((row) => row.user === user.userId) ?? null,
    save: async (user, input) => { const c = scoped(user); const rows = await c.list<AdaptationRecord>('adaptation_metrics', `user = '${esc(user.userId)}'`); const current = rows.find((row) => row.user === user.userId); return current ? c.update<AdaptationRecord>('adaptation_metrics', current.id, { ...input, user: user.userId }) : c.create<AdaptationRecord>('adaptation_metrics', { ...input, user: user.userId }); },
    listSessions: async (user) => scoped(user).list<ExecutionSession>('focus_sessions', `user = '${esc(user.userId)}'`),
  };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const validSessions = (sessions: ExecutionSession[]) => sessions.filter((s) => s.status === 'finished' && Number.isFinite(Number(s.plannedMinutes)) && Number(s.plannedMinutes) > 0 && Number.isFinite(Number(s.actualMinutes)) && Number(s.actualMinutes) > 0).slice(-100);
export function calculateAdaptationMetrics(sessions: ExecutionSession[]): AdaptationMetrics {
  const valid = validSessions(sessions).map((s) => ({ ...s, ratio: clamp(Number(s.actualMinutes) / Number(s.plannedMinutes), .25, 4) }));
  const grouped = (key: 'category' | 'energy') => Object.fromEntries([...new Set(valid.map((s) => s[key]).filter(Boolean))].map((name) => { const rows = valid.filter((s) => s[key] === name); return [String(name), { sampleSize: rows.length, multiplier: clamp(rows.reduce((sum, row) => sum + row.ratio, 0) / rows.length, .75, 1.75) }]; }));
  const windows = new Map<number, number>();
  for (const row of valid) { if (!row.finishedAt) continue; const hour = new Date(row.finishedAt).getHours(); const bucket = Math.floor(hour / 2) * 2; windows.set(bucket, (windows.get(bucket) ?? 0) + 1); }
  return { sampleSize: valid.length, byCategory: grouped('category'), byEnergy: grouped('energy'), preferredWindows: [...windows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([start, sampleSize]) => ({ start, end: start + 2, sampleSize })), rescheduleRate: valid.length ? clamp(valid.reduce((sum, row) => sum + Math.min(1, Math.max(0, Number(row.reschedules ?? 0))), 0) / valid.length, 0, 1) : 0 };
}
const suggestionFor = (metrics: AdaptationMetrics): AdaptationSuggestion[] => {
  const suggestions: AdaptationSuggestion[] = [];
  for (const [category, value] of Object.entries(metrics.byCategory)) if (value.sampleSize >= 3 && Math.abs(value.multiplier - 1) >= .12) suggestions.push({ id: `duration-category-${category}`, kind: 'duration', status: 'proposed', title: `Уточнити тривалість для категорії «${category}»`, detail: `Зазвичай такі задачі займають приблизно ${Math.round(value.multiplier * 100)}% початкової оцінки.`, adjustment: { category, multiplier: value.multiplier } });
  for (const [energy, value] of Object.entries(metrics.byEnergy)) if (value.sampleSize >= 3 && Math.abs(value.multiplier - 1) >= .12) suggestions.push({ id: `duration-energy-${energy}`, kind: 'duration', status: 'proposed', title: `Підлаштувати оцінки для енергії «${energy}»`, detail: `Вектор може врахувати твій фактичний темп у плануванні.`, adjustment: { energy, multiplier: value.multiplier } });
  if (metrics.preferredWindows[0]?.sampleSize >= 3) { const window = metrics.preferredWindows[0]; suggestions.push({ id: 'preferred-window', kind: 'window', status: 'proposed', title: 'Показувати складні задачі у твоє вікно фокусу', detail: `Найчастіше завершення припадають на ${String(window.start).padStart(2, '0')}:00–${String(window.end).padStart(2, '0')}:00.`, adjustment: window }); }
  return suggestions.slice(0, 3);
};
export interface AdaptationService { get(user: VerifiedUser): Promise<{ consent: boolean; metrics: AdaptationMetrics; suggestions: AdaptationSuggestion[] }>; setConsent(user: VerifiedUser, consent: boolean): Promise<AdaptationRecord>; accept(user: VerifiedUser, id: string): Promise<AdaptationSuggestion>; reject(user: VerifiedUser, id: string): Promise<AdaptationSuggestion>; reset(user: VerifiedUser): Promise<void>; accepted(user: VerifiedUser): Promise<AdaptationSuggestion[]>; }
export function createAdaptationService(repository: AdaptationRepository, now = () => new Date()): AdaptationService {
  const read = async (user: VerifiedUser) => { const row = await repository.get(user); return { row, consent: Boolean(row?.consent), metrics: (row?.metricsJson && typeof row.metricsJson === 'object' ? row.metricsJson : { sampleSize: 0, byCategory: {}, byEnergy: {}, preferredWindows: [], rescheduleRate: 0 }) as AdaptationMetrics, suggestions: (Array.isArray(row?.suggestionsJson) ? row?.suggestionsJson : []) as AdaptationSuggestion[] }; };
  const persist = async (user: VerifiedUser, consent: boolean, metrics: AdaptationMetrics, suggestions: AdaptationSuggestion[]) => repository.save(user, { consent, metricsJson: metrics, suggestionsJson: suggestions, updatedAt: now().toISOString() });
  return {
    async get(user) { const current = await read(user); if (!current.consent) return { consent: false, metrics: current.metrics, suggestions: [] }; if (current.metrics.sampleSize > 0 || current.suggestions.length) return { consent: true, metrics: current.metrics, suggestions: current.suggestions }; const metrics = calculateAdaptationMetrics(await repository.listSessions(user)); const suggestions = metrics.sampleSize >= 3 ? suggestionFor(metrics) : []; await persist(user, true, metrics, suggestions); return { consent: true, metrics, suggestions }; },
    async setConsent(user, consent) { const current = await read(user); if (!consent) return persist(user, false, current.metrics, []).then((row) => row); const metrics = calculateAdaptationMetrics(await repository.listSessions(user)); return persist(user, true, metrics, metrics.sampleSize >= 3 ? suggestionFor(metrics) : []); },
    async accept(user, id) { const current = await read(user); const item = current.suggestions.find((s) => s.id === id); if (!item) throw new RepositoryError('NOT_FOUND'); const updated = current.suggestions.map((s) => s.id === id ? { ...s, status: 'accepted' as const } : s); await persist(user, current.consent, current.metrics, updated); return updated.find((s) => s.id === id)!; },
    async reject(user, id) { const current = await read(user); const item = current.suggestions.find((s) => s.id === id); if (!item) throw new RepositoryError('NOT_FOUND'); const updated = current.suggestions.map((s) => s.id === id ? { ...s, status: 'rejected' as const } : s); await persist(user, current.consent, current.metrics, updated); return updated.find((s) => s.id === id)!; },
    async reset(user) { const current = await read(user); await persist(user, current.consent, current.metrics, current.suggestions.map((s) => ({ ...s, status: 'proposed' as const }))); },
    async accepted(user) { return (await read(user)).suggestions.filter((s) => s.status === 'accepted'); },
  };
}
