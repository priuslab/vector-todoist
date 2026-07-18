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

export const CANONICAL_OWNERSHIP_RULES = Object.freeze({
  listRule: '@request.auth.id != "" && user = @request.auth.id',
  viewRule: '@request.auth.id != "" && user = @request.auth.id',
  createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
  updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
  deleteRule: '@request.auth.id != "" && user = @request.auth.id',
});

function hasRedundantOuterParentheses(expression) {
  if (!expression.startsWith('(') || !expression.endsWith(')')) {
    return false;
  }

  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = '';
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth === 0 && index < expression.length - 1) {
        return false;
      }
    }
  }

  return depth === 0 && quote === '';
}

export function normalizeRuleExpression(expression) {
  let normalized = expression.trim().replace(/''/g, '""');

  while (hasRedundantOuterParentheses(normalized)) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
}

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

    for (const [field, expected] of Object.entries(CANONICAL_OWNERSHIP_RULES)) {
      const actual = normalizeRuleExpression(ruleValue(collection, field));
      if (actual !== normalizeRuleExpression(expected)) {
        errors.push(`${collectionName}.${field} must exactly match the canonical ownership rule`);
      }
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
