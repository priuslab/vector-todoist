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

const recordOwnerRuleFields = ['listRule', 'viewRule', 'deleteRule'];
const authId = '@request.auth.id';
const recordOwner = 'user = @request.auth.id';
const bodyOwner = '@request.body.user = @request.auth.id';

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

    for (const field of recordOwnerRuleFields) {
      const value = ruleValue(collection, field);
      if (!value.includes(authId)) {
        errors.push(`${collectionName}.${field} must reference @request.auth.id`);
      }
      if (!value.includes(recordOwner)) {
        errors.push(`${collectionName}.${field} must restrict records to @request.auth.id`);
      }
    }

    const createRule = ruleValue(collection, 'createRule');
    if (!createRule.includes(authId)) {
      errors.push(`${collectionName}.createRule must reference @request.auth.id`);
    }
    if (!createRule.includes(bodyOwner)) {
      errors.push(`${collectionName}.createRule must bind @request.body.user to @request.auth.id`);
    }

    const updateRule = ruleValue(collection, 'updateRule');
    if (!updateRule.includes(authId)) {
      errors.push(`${collectionName}.updateRule must reference @request.auth.id`);
    }
    if (!updateRule.includes(recordOwner)) {
      errors.push(`${collectionName}.updateRule must restrict records to @request.auth.id`);
    }
    if (!updateRule.includes('@request.body.user:isset = false') || !updateRule.includes(bodyOwner)) {
      errors.push(`${collectionName}.updateRule must prevent ownership changes`);
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
