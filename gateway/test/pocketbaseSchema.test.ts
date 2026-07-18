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

describe('PocketBase core schema contract', () => {
  it('defines every user-owned collection with auth-bound access rules', async () => {
    const source = await readFile(coreMigrationPath, 'utf8');

    for (const collection of userOwnedCollections) {
      const collectionSource = source.match(
        new RegExp(`name:\\s*['\"]${collection}['\"][\\s\\S]*?(?=name:\\s*['\"]|$)`),
      )?.[0];

      expect(collectionSource, `missing ${collection} collection`).toBeDefined();
      expect(collectionSource).toMatch(/listRule:\s*['\"][^'\"]*@request\.auth\.id[^'\"]*['\"]/);
      expect(collectionSource).toMatch(/viewRule:\s*['\"][^'\"]*@request\.auth\.id[^'\"]*['\"]/);
      expect(collectionSource).toMatch(/createRule:\s*['\"][^'\"]*@request\.auth\.id[^'\"]*['\"]/);
      expect(collectionSource).toMatch(/updateRule:\s*['\"][^'\"]*@request\.auth\.id[^'\"]*['\"]/);
      expect(collectionSource).toMatch(/deleteRule:\s*['\"][^'\"]*@request\.auth\.id[^'\"]*['\"]/);
    }
  });

  it('accepts the real migration and rejects an invalid rule fixture', async () => {
    const { validateMigrationSource } = await import(pathToFileURL(validatorPath).href) as {
      validateMigrationSource(source: string): string[];
    };
    const source = await readFile(coreMigrationPath, 'utf8');

    expect(validateMigrationSource(source)).toEqual([]);
    expect(
      validateMigrationSource(`
        new Collection({
          name: 'tasks',
          listRule: '@request.auth.id != \\\'\\\' && user = @request.auth.id',
          viewRule: '@request.auth.id != \\\'\\\' && user = @request.auth.id',
          createRule: '@request.auth.id != \\\'\\\' && @request.body.user = @request.auth.id',
          updateRule: '@request.auth.id != \\\'\\\' && user = @request.auth.id',
          deleteRule: null,
        });
      `),
    ).toContain('tasks.deleteRule must reference @request.auth.id');
  });
});
