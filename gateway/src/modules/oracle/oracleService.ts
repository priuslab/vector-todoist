import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { GoalGraphRepository, GoalRecord, ProjectRecord, IdeaRecord, GraphEdgeRecord } from '../../repositories/goalGraphRepository.js';
import type { TaskRecord, TaskRepository } from '../../repositories/taskRepository.js';

export type OracleNodeType = 'goal' | 'project' | 'idea' | 'task' | 'completed';
export interface OracleNode { id: string; type: OracleNodeType; title: string; status: string; completed: boolean; muted: boolean; alignmentScore: number; }
export interface OracleEdge { id: string; fromType: OracleNodeType; fromId: string; toType: OracleNodeType; toId: string; actor: 'user' | 'ai'; status: 'proposed' | 'confirmed' | 'rejected'; weight: number; rationale?: string; }
export interface OracleGraph { goalId?: string; nodes: OracleNode[]; edges: OracleEdge[]; }
export interface OraclePath { found: boolean; from: { type: OracleNodeType; id: string }; goalId: string; nodeIds: string[]; nodes: OracleNode[]; edgeIds: string[]; score: number; explanation: string; }
export interface OracleInsight { score: number; foundPath: boolean; headline: string; explanation: string; path: OraclePath; }

const nodeTypes: OracleNodeType[] = ['goal', 'project', 'idea', 'task', 'completed'];
const isNodeType = (value: string): value is OracleNodeType => nodeTypes.includes(value as OracleNodeType);
const key = (type: OracleNodeType, id: string) => `${type}:${id}`;
const titleOf = (record: Record<string, unknown>, type: OracleNodeType) => String(record.title ?? (type === 'idea' ? record.summary ?? record.text : record.id) ?? record.id);
const completed = (record: Record<string, unknown>, type: OracleNodeType) => type === 'completed' || record.status === 'completed';

function edgeWeight(edge: GraphEdgeRecord): number {
  if (edge.status === 'rejected') return 0;
  if (edge.status === 'confirmed' && edge.actor === 'user') return 1;
  if (edge.status === 'confirmed') return 0.85;
  return 0.5;
}

export interface OracleService {
  graph(user: VerifiedUser, goalId?: string): Promise<OracleGraph>;
  path(user: VerifiedUser, input: { fromType: OracleNodeType; fromId: string; goalId: string }): Promise<OraclePath>;
  insight(user: VerifiedUser, input: { fromType: OracleNodeType; fromId: string; goalId: string }): Promise<OracleInsight>;
}

export function createOracleService(deps: {
  repository: GoalGraphRepository;
  taskRepository?: TaskRepository;
  explain?: (input: { path: OraclePath; graph: OracleGraph }) => Promise<string>;
}): OracleService {
  const { repository, taskRepository } = deps;
  const collect = async (user: VerifiedUser) => {
    const [goals, projects, ideas, edges, tasks] = await Promise.all([
      repository.goals.list(user), repository.projects.list(user), repository.ideas.list(user), repository.edges.list(user),
      taskRepository ? taskRepository.list(user) : Promise.resolve([] as TaskRecord[]),
    ]);
    const nodeRows: Array<{ type: OracleNodeType; record: Record<string, unknown> }> = [
      ...goals.map((r) => ({ type: 'goal' as const, record: r })),
      ...projects.map((r) => ({ type: 'project' as const, record: r })),
      ...ideas.map((r) => ({ type: 'idea' as const, record: r })),
      ...tasks.map((r) => ({ type: r.status === 'completed' ? 'completed' as const : 'task' as const, record: r })),
    ];
    return { nodeRows, edges };
  };
  const build = async (user: VerifiedUser, goalId?: string): Promise<OracleGraph> => {
    const { nodeRows, edges } = await collect(user);
    const scoreMap = new Map<string, number>();
    for (const edge of edges) {
      const weight = edgeWeight(edge); if (!weight) continue;
      const to = edge.toType && isNodeType(edge.toType) ? key(edge.toType, String(edge.toId)) : '';
      const from = edge.fromType && isNodeType(edge.fromType) ? key(edge.fromType, String(edge.fromId)) : '';
      if (to) scoreMap.set(to, Math.max(scoreMap.get(to) ?? 0, weight));
      if (from) scoreMap.set(from, Math.max(scoreMap.get(from) ?? 0, weight));
    }
    const nodes = nodeRows.filter((row) => !goalId || (row.type === 'goal' && row.record.id === goalId) || row.record.goalId === goalId).map(({ type, record }) => {
      const nodeKey = key(type, String(record.id)); const isCompleted = completed(record, type);
      return { id: String(record.id), type, title: titleOf(record, type), status: String(record.status ?? 'active'), completed: isCompleted, muted: isCompleted, alignmentScore: Math.round((scoreMap.get(nodeKey) ?? 0) * 100) / 100 };
    }).sort((a, b) => key(a.type, a.id).localeCompare(key(b.type, b.id)));
    const visible = new Set(nodes.map((n) => key(n.type, n.id)));
    const safeEdges = edges.filter((e) => e.status !== 'rejected' && isNodeType(String(e.fromType)) && isNodeType(String(e.toType)) && visible.has(key(e.fromType as OracleNodeType, String(e.fromId))) && visible.has(key(e.toType as OracleNodeType, String(e.toId)))).map((e) => ({ id: String(e.id), fromType: e.fromType as OracleNodeType, fromId: String(e.fromId), toType: e.toType as OracleNodeType, toId: String(e.toId), actor: (e.actor === 'ai' ? 'ai' : 'user') as 'ai' | 'user', status: (e.status === 'confirmed' ? 'confirmed' : 'proposed') as 'confirmed' | 'proposed', weight: edgeWeight(e), ...(e.rationale ? { rationale: String(e.rationale) } : {}) })).sort((a, b) => a.id.localeCompare(b.id));
    return { ...(goalId ? { goalId } : {}), nodes, edges: safeEdges };
  };
  const path = async (user: VerifiedUser, input: { fromType: OracleNodeType; fromId: string; goalId: string }): Promise<OraclePath> => {
    const graph = await build(user);
    const start = key(input.fromType, input.fromId); const goal = key('goal', input.goalId);
    const nodesByKey = new Map(graph.nodes.map((n) => [key(n.type, n.id), n]));
    const fromNode = nodesByKey.get(start); const goalNode = nodesByKey.get(goal);
    const base = { from: { type: input.fromType, id: input.fromId }, goalId: input.goalId };
    if (!fromNode || !goalNode) return { ...base, found: false, nodeIds: [], nodes: [], edgeIds: [], score: 0, explanation: 'Не знайшов усієї інформації для побудови шляху.' };
    if (start === goal) return { ...base, found: true, nodeIds: [input.fromId], nodes: [fromNode], edgeIds: [], score: 1, explanation: 'Це вже обрана мета.' };
    const adjacency = new Map<string, OracleEdge[]>();
    for (const edge of graph.edges) { const fromKey = key(edge.fromType, edge.fromId); const list = adjacency.get(fromKey) ?? []; list.push(edge); adjacency.set(fromKey, list); }
    for (const list of adjacency.values()) list.sort((a, b) => (b.weight - a.weight) || key(a.toType, a.toId).localeCompare(key(b.toType, b.toId)) || a.id.localeCompare(b.id));
    type State = { node: string; nodes: string[]; edges: OracleEdge[]; score: number };
    const queue: State[] = [{ node: start, nodes: [start], edges: [], score: 1 }]; const best = new Map<string, { hops: number; score: number; signature: string }>(); best.set(start, { hops: 0, score: 1, signature: start });
    let answer: State | undefined;
    while (queue.length) {
      const state = queue.shift()!; if (state.node === goal) { answer = state; break; }
      for (const edge of adjacency.get(state.node) ?? []) {
        const next = key(edge.toType, edge.toId); if (state.nodes.includes(next)) continue;
        const candidate = { hops: state.edges.length + 1, score: state.score * edge.weight, signature: `${state.nodes.join('>')}>${next}` };
        const previous = best.get(next); if (previous && (previous.hops < candidate.hops || (previous.hops === candidate.hops && (previous.score > candidate.score || (previous.score === candidate.score && previous.signature <= candidate.signature))))) continue;
        best.set(next, candidate); queue.push({ node: next, nodes: [...state.nodes, next], edges: [...state.edges, edge], score: candidate.score });
      }
      queue.sort((a, b) => (a.edges.length - b.edges.length) || (b.score - a.score) || a.nodes.join('>').localeCompare(b.nodes.join('>')));
    }
    if (!answer) return { ...base, found: false, nodeIds: [], nodes: [], edgeIds: [], score: 0, explanation: 'Між цією точкою та метою поки немає підтвердженого шляху. Можеш додати зв’язок або залишити це як окрему ідею.' };
    const resultNodes = answer.nodes.map((item) => nodesByKey.get(item)!).filter(Boolean);
    return { ...base, found: true, nodeIds: resultNodes.map((n) => n.id), nodes: resultNodes, edgeIds: answer.edges.map((e) => e.id), score: Math.round(answer.score * 100) / 100, explanation: `Шлях складається з ${Math.max(0, resultNodes.length - 1)} зв’язків до мети.` };
  };
  return {
    graph: build,
    path,
    async insight(user, input) {
      const graph = await build(user, input.goalId); const result = await path(user, input); let explanation = result.explanation;
      if (deps.explain) { try { const text = await deps.explain({ path: result, graph }); if (typeof text === 'string' && text.trim().length <= 600) explanation = text.trim(); } catch { /* deterministic fallback */ } }
      return { score: result.score, foundPath: result.found, headline: result.found ? 'Ось найближчий шлях до мети' : 'Шлях ще потребує зв’язку', explanation, path: result };
    },
  };
}
