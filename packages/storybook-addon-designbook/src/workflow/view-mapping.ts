/**
 * View mappings: a `config.view.<id>` bundle has no fields. Its mapping binds fixed view
 * parts — config values read through the `$view` binding (the view's data-model entry) and
 * result values read from the selected `data/view.<id>.yml` record — to one wrapper component.
 */
import type { PlanTask } from './plan-document.js';
import type { ViewDef, ViewRow } from '../shared/view-bindings.js';

export { viewBindingsFor, viewDef, type ViewDef, type ViewRow, type ViewSort } from '../shared/view-bindings.js';

export interface ViewBinding {
  field: string;
  prop?: string;
  slot?: string;
  path?: string[];
  entity?: { entity_type: string; bundle: string; view_mode: string };
}

type PartTarget = 'prop' | 'slot' | 'any';

interface ViewPart {
  /** Where the part may be bound. */
  target: PartTarget;
  /** Whether the part reads the view config (`$view`) or the selected result record (`$fields`). */
  source: 'config' | 'result' | 'config+result';
}

/** The fixed parts a view mapping binds; `field` of a view binding names one of them. */
export const VIEW_PARTS: Record<string, ViewPart> = {
  rows: { target: 'slot', source: 'result' },
  title: { target: 'any', source: 'config' },
  header: { target: 'any', source: 'config' },
  footer: { target: 'any', source: 'config' },
  empty: { target: 'any', source: 'config+result' },
  pager: { target: 'prop', source: 'config' },
  items_per_page: { target: 'prop', source: 'config' },
  total: { target: 'prop', source: 'result' },
  page: { target: 'prop', source: 'result' },
  exposed_sorts: { target: 'prop', source: 'config' },
  settings: { target: 'prop', source: 'config' },
};

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function rowOf(def: ViewDef): ViewRow | undefined {
  const row = isObj(def.row) ? def.row : undefined;
  if (!row) return undefined;
  const entity_type = asString(row.entity_type);
  const bundle = asString(row.bundle);
  const view_mode = asString(row.view_mode);
  return entity_type && bundle && view_mode ? { entity_type, bundle, view_mode } : undefined;
}

/** The view's bindings with the `rows` binding targeting the view's row bundle and view mode. */
export function resolveViewBindings(def: ViewDef, bindings: ViewBinding[]): ViewBinding[] {
  const row = rowOf(def);
  return bindings.map((b) => (b.field === 'rows' && b.slot && !b.entity && row ? { ...b, entity: { ...row } } : b));
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function pathExpr(parts: string[]): string {
  return parts.map((p) => (IDENT.test(p) ? p : `\`${p}\``)).join('.');
}

function settingsAt(def: ViewDef, mode: string, path: string[]): unknown {
  const modeDef = isObj(def.view_modes) ? def.view_modes[mode] : undefined;
  let current: unknown = isObj(modeDef) ? modeDef.settings : undefined;
  for (const part of path) {
    if (!isObj(current)) return undefined;
    current = current[part];
  }
  return current;
}

/** The expression a view part compiles to. */
function partExpression(binding: ViewBinding, def: ViewDef, mode: string, rowIndex: Record<string, number>): string {
  switch (binding.field) {
    case 'rows': {
      const row = rowOf(def)!;
      const entity = `${row.entity_type}.${row.bundle}`;
      return `[$map($fields.rows, function($id) { { "entity": ${JSON.stringify(entity)}, "view_mode": ${JSON.stringify(row.view_mode)}, "record": $lookup(${JSON.stringify(rowIndex)}, $string($id)) } })]`;
    }
    case 'title':
    case 'header':
    case 'footer':
      return `$view.${binding.field}`;
    case 'empty':
      return '$count($fields.rows) = 0 ? $view.empty';
    case 'pager':
      return '$view.pager.type';
    case 'items_per_page':
      return '$view.pager.items_per_page';
    case 'total':
      return '$exists($fields.total) ? $fields.total : $count($fields.rows)';
    case 'page':
      return '$fields.page';
    case 'exposed_sorts':
      return '[$view.sorts[exposed = true].{ "value": field, "label": label }]';
    case 'settings':
      return `$view.view_modes.${pathExpr([mode, 'settings', ...(binding.path ?? [])])}`;
    default:
      throw new Error(`unknown view part ${binding.field}`);
  }
}

/**
 * Compile a view mapping: one wrapper component whose props and slots are the bound view
 * parts. `rowIndex` maps each row-bundle record id to its pool index.
 */
export function compileViewMapping(task: PlanTask, def: ViewDef, rowIndex: Record<string, number>): string {
  const component = String(task.params.component ?? '');
  if (!component) throw new Error('view mapping requires a wrapper component');
  if (!rowOf(def)) throw new Error('view mapping requires the view row (entity_type, bundle, view_mode)');
  const mapping = isObj(task.params.mapping) ? task.params.mapping : {};
  const mode = asString(mapping.view_mode);
  const bindings = (task.params.bindings as ViewBinding[] | undefined) ?? [];
  const props: string[] = [];
  const slots: string[] = [];
  for (const binding of bindings) {
    const expr = partExpression(binding, def, mode, rowIndex);
    if (binding.prop) props.push(`${JSON.stringify(binding.prop)}: ${expr}`);
    else if (binding.slot) slots.push(`${JSON.stringify(binding.slot)}: ${expr}`);
    else throw new Error(`view part ${binding.field} names no prop or slot`);
  }
  const propsBlock = props.length ? `,\n      "props": {\n        ${props.join(',\n        ')}\n      }` : '';
  const slotsBlock = slots.length ? `,\n      "slots": {\n        ${slots.join(',\n        ')}\n      }` : '';
  return `(
  $fields := $;
  [
    {
      "component": ${JSON.stringify(component)}${propsBlock}${slotsBlock}
    }
  ]
)
`;
}

export interface ViewCheckContext {
  /** Entity type and bundle of the view mapping (`view`, `<id>`). */
  bundle: string;
  view_mode: string;
  props: Record<string, unknown>;
  slots: Record<string, unknown>;
  /** View modes of a content bundle, or undefined when the bundle does not exist. */
  viewModesOf: (entityType: string, bundle: string) => Record<string, unknown> | undefined;
  /** Whether a mapping for `<et>.<bundle>:view:<mode>` is planned or reused. */
  hasMapping: (key: string) => boolean;
  /** Ordered sample records of a pool, after planned writes. */
  records: (entityType: string, bundle: string) => Array<{ id: string; values?: Record<string, unknown> }> | undefined;
}

export interface ViewCheckError {
  /** Task-relative path, e.g. `bindings[1].slot` or `mapping`. */
  path: string;
  message: string;
}

/**
 * Whether the backend knows the result total: a `full` pager counts it, and a view that shows
 * every row (no pager, or `none` without `items_per_page`) has its row count as the total.
 */
function countsTotal(def: ViewDef): boolean {
  if (!isObj(def.pager)) return true;
  const type = asString(def.pager.type);
  return type === 'full' || (type === 'none' && def.pager.items_per_page === undefined);
}

function pagerLabel(def: ViewDef): string {
  const pager = isObj(def.pager) ? def.pager : {};
  const type = asString(pager.type) || 'unset';
  return typeof pager.items_per_page === 'number' ? `${type} with items_per_page` : type;
}

/** Why a part has nothing to read on this view; undefined when it has. */
function configSourceMissing(def: ViewDef, binding: ViewBinding, mode: string): string | undefined {
  switch (binding.field) {
    case 'title':
    case 'header':
    case 'footer':
    case 'empty':
      return asString(def[binding.field]) ? undefined : `declares no ${binding.field}`;
    case 'pager':
      return isObj(def.pager) && asString(def.pager.type) ? undefined : 'declares no pager.type';
    case 'items_per_page':
      return isObj(def.pager) && typeof def.pager.items_per_page === 'number'
        ? undefined
        : 'declares no pager.items_per_page';
    case 'page':
      return isObj(def.pager) ? undefined : 'declares no pager';
    case 'total':
      return countsTotal(def)
        ? undefined
        : `pager ${pagerLabel(def)} counts no total; bind total only with pager full or a view that shows every row`;
    case 'exposed_sorts':
      return Array.isArray(def.sorts) && def.sorts.some((s) => isObj(s) && s.exposed === true)
        ? undefined
        : 'declares no exposed sort';
    case 'settings': {
      const path = binding.path ?? [];
      if (!path.length) return 'settings requires a path into the mode settings';
      return settingsAt(def, mode, path) === undefined
        ? `has no view_modes.${mode}.settings.${path.join('.')}`
        : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Validate a view mapping's bindings against the view part table, the wrapper contract,
 * the view's row and the sample pools. Paths are relative to the mapping task.
 */
export function validateViewMapping(def: ViewDef, bindings: ViewBinding[], ctx: ViewCheckContext): ViewCheckError[] {
  const errors: ViewCheckError[] = [];
  const name = `view.${ctx.bundle}`;
  const used = new Set<string>();
  let rowsBindings = 0;
  bindings.forEach((b, i) => {
    const p = `bindings[${i}]`;
    const part = VIEW_PARTS[b.field];
    if (!part) {
      errors.push({
        path: `${p}.field`,
        message: `unknown view part ${b.field} (one of ${Object.keys(VIEW_PARTS).join(', ')})`,
      });
      return;
    }
    if (b.prop && b.slot) errors.push({ path: p, message: 'names both prop and slot' });
    if (part.target === 'slot' && b.prop) {
      errors.push({ path: `${p}.prop`, message: `view part ${b.field} binds a slot, not a prop` });
    }
    if (part.target === 'prop' && b.slot) {
      errors.push({ path: `${p}.slot`, message: `view part ${b.field} binds a prop, not a slot` });
    }
    if (b.path?.length && b.field !== 'settings') {
      errors.push({ path: `${p}.path`, message: `only the settings part takes a path` });
    }
    if (b.field === 'rows') {
      if (b.slot) rowsBindings++;
      if (b.entity) {
        errors.push({
          path: `${p}.entity`,
          message: `rows renders the view's row; omit entity (declare it in config.view.${ctx.bundle}.row)`,
        });
      }
    }
    const missing = configSourceMissing(def, b, ctx.view_mode);
    if (missing) errors.push({ path: `${p}.field`, message: `${name} ${missing}` });
    if (b.prop) {
      const t = `prop:${b.prop}`;
      if (used.has(t)) errors.push({ path: `${p}.prop`, message: `duplicate target ${b.prop}` });
      used.add(t);
      if (!(b.prop in ctx.props)) errors.push({ path: `${p}.prop`, message: `unknown prop ${b.prop}` });
    }
    if (b.slot) {
      const t = `slot:${b.slot}`;
      if (used.has(t)) errors.push({ path: `${p}.slot`, message: `duplicate target ${b.slot}` });
      used.add(t);
      if (!(b.slot in ctx.slots)) errors.push({ path: `${p}.slot`, message: `unknown slot ${b.slot}` });
    }
  });
  if (rowsBindings !== 1) {
    errors.push({
      path: 'bindings',
      message: `a view mapping binds rows to exactly one slot (found ${rowsBindings})`,
    });
  }

  const row = rowOf(def);
  if (!row) {
    errors.push({ path: 'mapping', message: `${name} declares no complete row (entity_type, bundle, view_mode)` });
    return errors;
  }
  const rowEntity = `${row.entity_type}.${row.bundle}`;
  const rowModes = ctx.viewModesOf(row.entity_type, row.bundle);
  if (!rowModes) {
    errors.push({ path: 'mapping', message: `${name} row: unknown bundle ${rowEntity}` });
  } else if (!(row.view_mode in rowModes)) {
    errors.push({ path: 'mapping', message: `${name} row: ${rowEntity} has no view mode "${row.view_mode}"` });
  }
  const rowKey = `${rowEntity}:view:${row.view_mode}`;
  if (!ctx.hasMapping(rowKey)) errors.push({ path: 'mapping', message: `${name} row: missing mapping ${rowKey}` });
  const rowPool = ctx.records(row.entity_type, row.bundle) ?? [];
  if (!rowPool.length) errors.push({ path: 'mapping', message: `empty required samples for ${rowEntity}` });
  const results = ctx.records('view', ctx.bundle) ?? [];
  if (!results.length) errors.push({ path: 'mapping', message: `empty required samples for ${name}` });
  const rowIds = new Set(rowPool.map((rec) => String(rec.id)));
  for (const rec of results) {
    const raw = rec.values?.rows;
    if (!Array.isArray(raw)) {
      errors.push({ path: 'mapping', message: `${name} result ${rec.id}: rows must be an array of row ids` });
      continue;
    }
    const ids = raw.map(String);
    const missing = ids.filter((id) => !rowIds.has(id));
    if (missing.length && rowPool.length) {
      errors.push({
        path: 'mapping',
        message: `${name} result ${rec.id} lists rows missing from ${rowEntity}: ${missing.join(', ')}`,
      });
    }
  }
  return errors;
}
