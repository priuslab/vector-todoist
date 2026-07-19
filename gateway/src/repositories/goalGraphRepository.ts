import type { PocketBaseClient, PocketBaseRecord } from '../pocketbase/client.js';
import type { VerifiedUser } from '../auth/verifyPocketBaseToken.js';
import { createOwned, deleteOwned, listOwned, owned, updateOwned } from './base.js';

export type GoalRecord = PocketBaseRecord & { title?: string; description?: string; status?: string; deadline?: string | null; progress?: number };
export type ProjectRecord = PocketBaseRecord & { title?: string; description?: string; status?: string; goalId?: string | null; progress?: number };
export type IdeaRecord = PocketBaseRecord & { text?: string; summary?: string; status?: string; sourceDump?: string; projectId?: string | null; goalId?: string | null };
export type GraphEdgeRecord = PocketBaseRecord & { fromType?: string; fromId?: string; toType?: string; toId?: string; actor?: string; status?: string; confidence?: number; rationale?: string };
export interface GoalGraphRepository {
  goals: { create(u: VerifiedUser, i: Record<string, unknown>): Promise<GoalRecord>; get(u: VerifiedUser, id: string): Promise<GoalRecord | null>; list(u: VerifiedUser): Promise<GoalRecord[]>; update(u: VerifiedUser, id: string, i: Record<string, unknown>): Promise<GoalRecord>; delete(u: VerifiedUser, id: string): Promise<void> };
  projects: { create(u: VerifiedUser, i: Record<string, unknown>): Promise<ProjectRecord>; get(u: VerifiedUser, id: string): Promise<ProjectRecord | null>; list(u: VerifiedUser): Promise<ProjectRecord[]>; update(u: VerifiedUser, id: string, i: Record<string, unknown>): Promise<ProjectRecord>; delete(u: VerifiedUser, id: string): Promise<void> };
  ideas: { create(u: VerifiedUser, i: Record<string, unknown>): Promise<IdeaRecord>; get(u: VerifiedUser, id: string): Promise<IdeaRecord | null>; list(u: VerifiedUser): Promise<IdeaRecord[]>; update(u: VerifiedUser, id: string, i: Record<string, unknown>): Promise<IdeaRecord>; delete(u: VerifiedUser, id: string): Promise<void> };
  edges: { create(u: VerifiedUser, i: Record<string, unknown>): Promise<GraphEdgeRecord>; get(u: VerifiedUser, id: string): Promise<GraphEdgeRecord | null>; list(u: VerifiedUser): Promise<GraphEdgeRecord[]>; update(u: VerifiedUser, id: string, i: Record<string, unknown>): Promise<GraphEdgeRecord>; delete(u: VerifiedUser, id: string): Promise<void> };
}

function collection<T extends PocketBaseRecord>(client: PocketBaseClient, name: string) {
  return { create: (u: VerifiedUser, i: Record<string, unknown>) => createOwned<T>(client, name, u, i), get: (u: VerifiedUser, id: string) => owned<T>(client, name, u, id), list: (u: VerifiedUser) => listOwned<T>(client, name, u), update: (u: VerifiedUser, id: string, i: Record<string, unknown>) => updateOwned<T>(client, name, u, id, i), delete: (u: VerifiedUser, id: string) => deleteOwned(client, name, u, id) };
}

export function createGoalGraphRepository(client: PocketBaseClient): GoalGraphRepository {
  return { goals: collection<GoalRecord>(client, 'goals'), projects: collection<ProjectRecord>(client, 'projects'), ideas: collection<IdeaRecord>(client, 'ideas'), edges: collection<GraphEdgeRecord>(client, 'graph_edges') };
}
