import type { GraphEdgeRecord } from '../../repositories/goalGraphRepository.js';

/** Deterministic, deadline-neutral alignment weights. User-confirmed links are strongest. */
export function edgeAlignmentWeight(edge: Pick<GraphEdgeRecord, 'actor' | 'status'>): number {
  if (edge.status === 'rejected') return 0;
  if (edge.status === 'confirmed' && edge.actor === 'user') return 1;
  if (edge.status === 'confirmed') return 0.85;
  return 0.5;
}

export function calculateAlignmentScore(edges: Array<Pick<GraphEdgeRecord, 'fromType' | 'fromId' | 'toType' | 'toId' | 'actor' | 'status'>>, nodeKey: string): number {
  let score = 0;
  for (const edge of edges) {
    const weight = edgeAlignmentWeight(edge);
    if (`${edge.fromType}:${edge.fromId}` === nodeKey || `${edge.toType}:${edge.toId}` === nodeKey) score = Math.max(score, weight);
  }
  return Math.round(score * 100) / 100;
}
