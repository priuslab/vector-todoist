export interface PathEdge { id: string; from: string; to: string; weight: number; }
export interface FoundPath { nodes: string[]; edges: PathEdge[]; score: number; }

/** Shortest useful path. Cycles are ignored; ties are resolved by score then lexical signature. */
export function findOraclePath(start: string, goal: string, edges: PathEdge[]): FoundPath | null {
  if (start === goal) return { nodes: [start], edges: [], score: 1 };
  const adjacency = new Map<string, PathEdge[]>();
  for (const edge of edges) { const list = adjacency.get(edge.from) ?? []; list.push(edge); adjacency.set(edge.from, list); }
  for (const list of adjacency.values()) list.sort((a, b) => (b.weight - a.weight) || a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
  type State = { node: string; nodes: string[]; path: PathEdge[]; score: number };
  const queue: State[] = [{ node: start, nodes: [start], path: [], score: 1 }];
  const best = new Map<string, { hops: number; score: number; signature: string }>([[start, { hops: 0, score: 1, signature: start }]]);
  while (queue.length) {
    const state = queue.shift()!; if (state.node === goal) return { nodes: state.nodes, edges: state.path, score: Math.round(state.score * 100) / 100 };
    for (const edge of adjacency.get(state.node) ?? []) {
      if (state.nodes.includes(edge.to)) continue;
      const candidate = { hops: state.path.length + 1, score: state.score * edge.weight, signature: `${state.nodes.join('>')}>${edge.to}` };
      const prior = best.get(edge.to); if (prior && (prior.hops < candidate.hops || (prior.hops === candidate.hops && (prior.score > candidate.score || (prior.score === candidate.score && prior.signature <= candidate.signature))))) continue;
      best.set(edge.to, candidate); queue.push({ node: edge.to, nodes: [...state.nodes, edge.to], path: [...state.path, edge], score: candidate.score });
    }
    queue.sort((a, b) => (a.path.length - b.path.length) || (b.score - a.score) || a.nodes.join('>').localeCompare(b.nodes.join('>')));
  }
  return null;
}
