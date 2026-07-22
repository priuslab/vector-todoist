import { describe, expect, it } from 'vitest';
import { analyzeBrainDumpPrompt } from '../src/modules/ai/prompts/analyzeBrainDump.v1.js';

describe('analyzeBrainDumpPrompt', () => {
  it('states every required JSON field and enum so lighter fallback models produce a valid analysis', () => {
    const prompt = analyzeBrainDumpPrompt('Потрібно написати план.');

    expect(prompt).toContain('Усі поля summary, confidence, questions, tasks, ideas і context обов’язкові');
    expect(prompt).toContain('Допустимі priority: "low", "medium", "high", "urgent"');
    expect(prompt).toContain('deadline: ISO datetime з часовим поясом або null');
    expect(prompt).toContain('field: короткий ідентифікатор поля');
  });
});
