import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const caddyFragmentPath = resolve(import.meta.dirname, '../../deploy/Caddyfile.fragment');

describe('Caddy deployment contract', () => {
  it('uses mutually exclusive routes to deny the PocketBase admin UI before proxying /pb', async () => {
    const source = await readFile(caddyFragmentPath, 'utf8');
    const adminRoute = source.indexOf('handle /pb/_* {');
    const pocketbaseRoute = source.indexOf('handle_path /pb/* {');

    expect(source).toMatch(/handle \/api\/\* \{[\s\S]*?reverse_proxy \{\$VECTOR_GATEWAY_UPSTREAM\}/);
    expect(source).toMatch(/handle \/webhooks\/\* \{[\s\S]*?reverse_proxy \{\$VECTOR_GATEWAY_UPSTREAM\}/);
    expect(source).toMatch(/handle \/pb\/_\* \{\s*respond 404\s*\}/);
    expect(source).toMatch(/handle_path \/pb\/\* \{[\s\S]*?reverse_proxy \{\$VECTOR_POCKETBASE_UPSTREAM\}/);
    expect(adminRoute).toBeGreaterThanOrEqual(0);
    expect(pocketbaseRoute).toBeGreaterThan(adminRoute);
  });
});
