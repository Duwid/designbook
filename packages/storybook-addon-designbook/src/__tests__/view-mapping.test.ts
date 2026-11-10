/**
 * View mappings: a `config.view.<id>` bundle binds fixed view parts to one wrapper component.
 * Plan build validates them against the part table, the contract, the row and the sample
 * pools; the scene tree descends from the view through its rows into the row mapping.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { buildPlan, type TaskList } from '../workflow/plan-build.js';
import type { Plan, PlanTask } from '../workflow/plan-document.js';
import { deriveComposition, renderCompositionTree } from '../workflow/plan-composition.js';
import { compilePlannedMapping } from '../workflow/plan-composition-result.js';
import { VIEW_PARTS, viewDef, type ViewDef } from '../workflow/view-mapping.js';
import type { DesignbookConfig } from '../shared/config.js';

const agents = resolve(process.cwd(), '../../.agents');
const vueOpts = {
  agentsDir: agents,
  config: {
    data: '/tmp/view-mapping',
    technology: 'html',
    backend: 'none',
    'frameworks.component': 'vue',
    'frameworks.css': 'tailwind',
    extensions: [],
    'component.namespace': 'test_integration_vue',
  } as unknown as DesignbookConfig,
};

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures/plans/view-tasks.json'), 'utf8'),
) as TaskList;

type Binding = { field: string; prop?: string; slot?: string; path?: string[]; entity?: Record<string, string> };

function list(): TaskList {
  return structuredClone(fixture);
}

function viewOf(l: TaskList): ViewDef {
  return (l.composition!.data_model as { config: { view: { contacts: ViewDef } } }).config.view.contacts;
}

function viewBindings(l: TaskList): Binding[] {
  return l.tasks.find((t) => t.step === 'map-entity' && t.title === 'contacts')!.params!.bindings as Binding[];
}

function task(l: TaskList, step: string, title: string) {
  return l.tasks.find((t) => t.step === step && t.title === title)!;
}

async function errorsOf(l: TaskList): Promise<string> {
  const { plan, errors } = await buildPlan(l, vueOpts);
  expect(plan).toBeNull();
  return errors.join('\n');
}

async function build(l: TaskList = list()): Promise<Plan> {
  const { plan, errors } = await buildPlan(l, vueOpts);
  expect(errors).toEqual([]);
  return plan!;
}

function mappingTask(plan: Plan, title: string): PlanTask {
  for (const step of plan.steps) {
    const found = step.tasks.find((t) => t.name.startsWith('map-entity') && t.title === title);
    if (found) return found;
  }
  throw new Error(`mapping ${title} not found`);
}

describe('view mappings — accepted structures', () => {
  it.each(['list-view', 'grid'])('accepts a config.view bundle whose mode template is %s', async (template) => {
    const l = list();
    viewOf(l).view_modes.default!.template = template;
    await build(l);
  });

  it('still rejects list-view on a content bundle', async () => {
    const l = list();
    const user = (l.composition!.data_model as { content: { user: { user: { view_modes: Record<string, unknown> } } } })
      .content.user.user;
    user.view_modes.contact = { template: 'list-view' };
    expect(await errorsOf(l)).toContain('user.user:contact uses unsupported structure list-view');
  });

  it('resolves only for a declared config.view entry', () => {
    const model = fixture.composition!.data_model;
    expect(viewDef(model, 'view', 'contacts')?.row.bundle).toBe('user');
    expect(viewDef(model, 'view', 'missing')).toBeUndefined();
    expect(viewDef(model, 'user', 'user')).toBeUndefined();
  });

  it('knows exactly the documented view parts', () => {
    expect(Object.keys(VIEW_PARTS).sort()).toEqual(
      [
        'empty',
        'exposed_sorts',
        'footer',
        'header',
        'items_per_page',
        'page',
        'pager',
        'rows',
        'settings',
        'title',
        'total',
      ].sort(),
    );
  });
});

describe('view mappings — binding errors', () => {
  const at = 'map-entity [contacts]';

  it('rejects an unknown part', async () => {
    const l = list();
    viewBindings(l)[0]!.field = 'headline';
    expect(await errorsOf(l)).toContain(`${at} bindings[0].field: unknown view part headline`);
  });

  it('rejects rows bound to a prop', async () => {
    const l = list();
    const rows = viewBindings(l).find((b) => b.field === 'rows')!;
    delete rows.slot;
    rows.prop = 'title';
    const errors = await errorsOf(l);
    expect(errors).toContain(`${at} bindings[7].prop: view part rows binds a slot, not a prop`);
    expect(errors).toContain(`${at} bindings: a view mapping binds rows to exactly one slot (found 0)`);
  });

  it('rejects rows with an entity descriptor', async () => {
    const l = list();
    viewBindings(l).find((b) => b.field === 'rows')!.entity = {
      entity_type: 'user',
      bundle: 'user',
      view_mode: 'contact',
    };
    expect(await errorsOf(l)).toContain(`${at} bindings[7].entity: rows renders the view's row; omit entity`);
  });

  it('rejects a mapping without rows', async () => {
    const l = list();
    const t = task(l, 'map-entity', 'contacts');
    t.params!.bindings = viewBindings(l).filter((b) => b.field !== 'rows');
    expect(await errorsOf(l)).toContain(`${at} bindings: a view mapping binds rows to exactly one slot (found 0)`);
  });

  it('rejects title when the view declares no title', async () => {
    const l = list();
    delete viewOf(l).title;
    expect(await errorsOf(l)).toContain(`${at} bindings[0].field: view.contacts declares no title`);
  });

  it('rejects a settings path the mode does not declare', async () => {
    const l = list();
    viewBindings(l).find((b) => b.field === 'settings')!.path = ['gap'];
    expect(await errorsOf(l)).toContain(
      `${at} bindings[6].field: view.contacts has no view_modes.default.settings.gap`,
    );
  });

  it('rejects total bound to a slot', async () => {
    const l = list();
    const total = viewBindings(l).find((b) => b.field === 'total')!;
    delete total.prop;
    total.slot = 'empty';
    expect(await errorsOf(l)).toContain(`${at} bindings[1].slot: view part total binds a prop, not a slot`);
  });

  it('rejects a view whose row mapping is neither planned nor reused', async () => {
    const l = list();
    l.tasks = l.tasks.filter((t) => !(t.step === 'map-entity' && t.title === 'contact'));
    expect(await errorsOf(l)).toContain(`${at} mapping: view.contacts row: missing mapping user.user:view:contact`);
  });

  it('rejects an empty view result pool', async () => {
    const l = list();
    l.tasks = l.tasks.filter((t) => !(t.step === 'create-sample-data' && t.title === 'contacts'));
    expect(await errorsOf(l)).toContain(`${at} mapping: empty required samples for view.contacts`);
  });

  it('rejects a result record that lists a missing row id', async () => {
    const l = list();
    const records = task(l, 'create-sample-data', 'contacts').params!.records as Array<{
      values: { rows: string[] };
    }>;
    records[0]!.values.rows.push('contacts-9');
    expect(await errorsOf(l)).toContain(
      `${at} mapping: view.contacts result filled lists rows missing from user.user: contacts-9`,
    );
  });
});

describe('view mappings — scene tree', () => {
  it('descends from the view result record through rows into the row mapping', async () => {
    const plan = await build();
    const result = deriveComposition(plan);
    expect(result.errors).toEqual([]);
    const text = renderCompositionTree(result.tree);
    expect(text).toContain('view.contacts [default] record 0 → test_integration_vue:listing (neu)');
    expect(text).toContain('prop title ← title');
    expect(text).toContain('prop count ← total');
    expect(text).toContain('slot rows ← rows (reference, 2 selected records)');
    expect(text).toContain('user.user [contact] → test_integration_vue:contact_row (neu)');
    expect(text).toContain('prop name ← name');
  });

  it('counts the rows of the record the scene selects', async () => {
    const l = list();
    (task(l, 'write-scene', 'Contacts').params!.items as Array<Record<string, unknown>>)[0]!.record = 1;
    const text = renderCompositionTree(deriveComposition(await build(l)).tree);
    expect(text).toContain('view.contacts [default] record 1');
    expect(text).toContain('slot rows ← rows (reference, 0 selected records)');
  });
});

describe('view mappings — reused view mapping', () => {
  async function reuse(source: (plan: Plan) => string): Promise<{ plan: Plan | null; errors: string[] }> {
    const full = await build();
    const text = source(full);
    const dir = mkdtempSync(join(tmpdir(), 'view-map-'));
    const file = join(dir, 'view.contacts.default.jsonata');
    writeFileSync(file, text);
    try {
      const l = list();
      const own = task(l, 'map-entity', 'contacts');
      l.composition = {
        ...l.composition!,
        mappings: [
          {
            identity: own.params!.mapping as Record<string, unknown>,
            component: own.params!.component as string,
            bindings: own.params!.bindings as unknown[],
            source: file,
            hash: createHash('sha256').update(text).digest('hex'),
          },
        ],
      };
      l.tasks = l.tasks.filter((t) => t !== own);
      return await buildPlan(l, vueOpts);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('rejects a hand-enumerated view mapping', async () => {
    const { plan, errors } = await reuse(
      () =>
        '[\n  { "type": "entity", "entity_type": "user", "bundle": "user", "view_mode": "contact", "record": 0 }\n]\n',
    );
    expect(plan).toBeNull();
    expect(errors.join('\n')).toMatch(/composition\.mappings\[0\]: mapping AST does not match the declared bindings/);
  });

  it('accepts the compiled view mapping', async () => {
    const { plan, errors } = await reuse((full) => compilePlannedMapping(mappingTask(full, 'contacts'), full));
    expect(errors).toEqual([]);
    expect(renderCompositionTree(deriveComposition(plan!).tree)).toContain('view.contacts [default] record 0');
  });
});
