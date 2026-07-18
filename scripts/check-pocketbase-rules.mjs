import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const USER_OWNED_COLLECTIONS = [
  'work_profiles',
  'brain_dumps',
  'tasks',
  'ideas',
  'ai_sessions',
  'change_sets',
];

const ownerRuleFields = ['listRule', 'viewRule', 'updateRule', 'deleteRule'];

function collectionSource(source, collectionName) {
  const starts = [...source.matchAll(/new Collection\(\{/g)].map((match) => match.index);

  for (const [index, start] of starts.entries()) {
    const candidate = source.slice(start, starts[index + 1]);
    if (new RegExp(`name:\\s*['\"]${collectionName}['\"]`).test(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function ruleValue(source, field) {
  const match = new RegExp(`${field}:\\s*(['\"])([\\s\\S]*?)\\1`).exec(source);
  return match?.[2] ?? '';
}

export function validateMigrationSource(source) {
  const errors = [];

  for (const collectionName of USER_OWNED_COLLECTIONS) {
    const collection = collectionSource(source, collectionName);

    if (!collection) {
      errors.push(`missing ${collectionName} collection`);
      continue;
    }

    for (const field of ownerRuleFields) {
      const value = ruleValue(collection, field);
      if (!value.includes('@request.auth.id')) {
        errors.push(`${collectionName}.${field} must reference @request.auth.id`);
      }
    }

    const createRule = ruleValue(collection, 'createRule');
    if (!createRule.includes('@request.auth.id')) {
      errors.push(`${collectionName}.createRule must reference @request.auth.id`);
    }
  }

  return errors;
}

export async function validateMigrationFile(filePath) {
  return validateMigrationSource(await readFile(filePath, 'utf8'));
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const migrationPath = resolve(root, 'pocketbase/pb_migrations/1784332800_core_collections.js');
  const errors = await validateMigrationFile(migrationPath);

  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }

  console.log('All user-owned collections have auth rules');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
