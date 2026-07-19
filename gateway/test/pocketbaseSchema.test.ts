import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const coreMigrationPath = resolve(
  import.meta.dirname,
  '../../pocketbase/pb_migrations/1784332800_core_collections.js',
);
const validatorPath = resolve(import.meta.dirname, '../../scripts/check-pocketbase-rules.mjs');

const userOwnedCollections = [
  'work_profiles',
  'brain_dumps',
  'tasks',
  'ideas',
  'ai_sessions',
  'change_sets',
] as const;

function collectionSource(source: string, collection: string): string {
  const starts = [...source.matchAll(/new Collection\(\{/g)].map((match) => match.index);

  for (const [index, start] of starts.entries()) {
    const candidate = source.slice(start, starts[index + 1]);
    if (new RegExp(`name:\\s*['\"]${collection}['\"]`).test(candidate)) {
      return candidate;
    }
  }

  return '';
}

function replaceRule(source: string, collection: string, rule: string, value: string): string {
  const collectionPattern = new RegExp(
    `(name:\\s*['\"]${collection}['\"][\\s\\S]*?${rule}:\\s*)['\"][^'\"]*['\"]`,
  );

  return source.replace(collectionPattern, `$1'${value}'`);
}

function ruleValue(source: string, rule: string): string {
  return new RegExp(`${rule}:\\s*'([^']*)'`).exec(source)?.[1] ?? '';
}

describe('PocketBase core schema contract', () => {
  it('makes calendar watch plaintext token optional via a reversible follow-up migration', async () => {
    const source = await readFile(resolve(import.meta.dirname, '../../pocketbase/pb_migrations/1784333030_calendar_watch_token_hash.js'), 'utf8');
    expect(source).toContain('token.required = false');
    expect(source).toContain('token.required = true');
    expect(source).toContain('channelTokenHash');
  });
  it('defines every user-owned collection with auth-bound access rules', async () => {
    const source = await readFile(coreMigrationPath, 'utf8');

    for (const collection of userOwnedCollections) {
      const ruleSource = collectionSource(source, collection);

      expect(ruleSource, `missing ${collection} collection`).not.toBe('');
      expect(ruleValue(ruleSource, 'listRule')).toContain('user = @request.auth.id');
      expect(ruleValue(ruleSource, 'viewRule')).toContain('user = @request.auth.id');
      expect(ruleValue(ruleSource, 'createRule')).toContain('@request.body.user = @request.auth.id');
      expect(ruleValue(ruleSource, 'updateRule')).toContain('user = @request.auth.id');
      expect(ruleValue(ruleSource, 'updateRule')).toContain('@request.body.user:isset = false');
      expect(ruleValue(ruleSource, 'updateRule')).toContain('@request.body.user = @request.auth.id');
      expect(ruleValue(ruleSource, 'deleteRule')).toContain('user = @request.auth.id');
    }
  });

  it('owns the auth collection reversibly and permits false or zero task values', async () => {
    const source = await readFile(coreMigrationPath, 'utf8');

    expect(source).toMatch(/const users = new Collection\(\{[\s\S]*?type: 'auth',[\s\S]*?name: 'users'/);
    expect(source).not.toMatch(/findCollectionByNameOrId\('users'\)/);
    expect(source).toMatch(/\['change_sets', 'ai_sessions', 'ideas', 'tasks', 'brain_dumps', 'work_profiles', 'users'\]/);

    const tasks = collectionSource(source, 'tasks');
    expect(tasks).toMatch(/name: 'flexible'\s*\}/);
    expect(tasks).toMatch(/name: 'locked'\s*\}/);
    expect(tasks).toMatch(/name: 'rescheduleCount', min: 0, onlyInt: true/);
    expect(tasks).not.toMatch(/name: 'flexible', required:/);
    expect(tasks).not.toMatch(/name: 'locked', required:/);
    expect(tasks).not.toMatch(/name: 'rescheduleCount', required:/);
    expect(source.match(/onlyInt: true/g)).toHaveLength(5);
  });

  it('stores onboarding completion on the PocketBase auth record with a false default', async () => {
    const source = await readFile(coreMigrationPath, 'utf8');
    const users = collectionSource(source, 'users');

    expect(users).toMatch(/type: 'bool', name: 'onboardingCompleted', default: false/);
  });

  it('accepts only canonical ownership rules for every user-owned collection', async () => {
    const { validateMigrationSource } = await import(pathToFileURL(validatorPath).href) as {
      validateMigrationSource(source: string): string[];
    };
    const source = await readFile(coreMigrationPath, 'utf8');

    expect(validateMigrationSource(source)).toEqual([]);

    for (const collection of userOwnedCollections) {
      for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
        expect(validateMigrationSource(replaceRule(source, collection, rule, '@request.auth.id != ""')))
          .toContain(`${collection}.${rule} must exactly match the canonical ownership rule`);
      }
    }

    expect(validateMigrationSource(replaceRule(
      source,
      'tasks',
      'listRule',
      '@request.auth.id != "" && (user = @request.auth.id || @request.auth.id != "")',
    ))).toContain('tasks.listRule must exactly match the canonical ownership rule');
    expect(validateMigrationSource(replaceRule(
      source,
      'tasks',
      'createRule',
      '@request.auth.id != "" && @request.body.user = @request.auth.id /* ownership decoy */',
    ))).toContain('tasks.createRule must exactly match the canonical ownership rule');
  });
});
