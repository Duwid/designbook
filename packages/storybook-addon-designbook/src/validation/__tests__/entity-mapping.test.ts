import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { validateEntityMapping } from '../entity-mapping.js';
import type { DesignbookConfig } from '../../shared/config.js';

const fixturesDir = resolve(import.meta.dirname, 'fixtures', 'entity-mapping');

function makeConfig(dataDir: string): DesignbookConfig {
  return {
    data: dataDir,
  } as DesignbookConfig;
}

describe('validateEntityMapping', () => {
  it('validates a mapping against records from the merged data/ pool', async () => {
    // config.data is fixturesDir, which has data/node.article.yml — a bare,
    // section-tagged record array. The validator runs the mapping against it.
    const mappingFile = resolve(fixturesDir, 'entity-mapping', 'node.article.default.jsonata');
    const result = await validateEntityMapping(mappingFile, makeConfig(fixturesDir));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns error when no sample data exists in the data/ pool', async () => {
    const mappingFile = resolve(fixturesDir, 'entity-mapping-no-demo', 'node.article.default.jsonata');
    const result = await validateEntityMapping(mappingFile, makeConfig('/nonexistent/data'));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('No sample data'))).toBe(true);
  });

  it('validates a view mapping with $view bound to the config.view entry', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'view-mapping-'));
    mkdirSync(join(dir, 'data'));
    mkdirSync(join(dir, 'entity-mapping'));
    writeFileSync(
      join(dir, 'data-model.yml'),
      'content: {}\nconfig:\n  view:\n    contacts:\n      title: My contacts\n      row: { entity_type: user, bundle: user, view_mode: contact }\n      view_modes: { default: { template: list-view } }\n',
    );
    writeFileSync(join(dir, 'data', 'view.contacts.yml'), '- id: filled\n  rows: ["1"]\n- id: empty\n  rows: []\n');
    const file = join(dir, 'entity-mapping', 'view.contacts.default.jsonata');
    // Without the binding, $view is undefined and the mapping emits a node without a component.
    writeFileSync(
      file,
      '$exists($view.title) ? [{ "component": "listing", "props": { "title": $view.title } }] : [{ "missing": "view" }]',
    );
    try {
      const result = await validateEntityMapping(file, makeConfig(dir));
      expect(result).toEqual({ valid: true, errors: [], warnings: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
