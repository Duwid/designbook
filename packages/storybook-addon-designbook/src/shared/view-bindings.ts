/**
 * A View's data-model entry (`config.view.<id>`, schema ViewBundle) and the JSONata bindings a
 * View mapping evaluates with: `$view` is that entry. Shared by plan build, runtime rendering
 * and mapping validation.
 */

export interface ViewRow {
  entity_type: string;
  bundle: string;
  view_mode: string;
}

export interface ViewSort {
  field: string;
  order?: string;
  exposed?: boolean;
  label?: string;
}

/** One `config.view.<id>` entry of the data model (schema `ViewBundle`). */
export interface ViewDef {
  label?: string;
  purpose?: string;
  display?: string;
  path?: string;
  title?: string;
  row: ViewRow;
  pager?: { type?: string; items_per_page?: number };
  empty?: string;
  header?: string;
  footer?: string;
  sorts?: ViewSort[];
  filters?: Record<string, unknown>;
  view_modes: Record<string, { template?: string; label?: string; settings?: Record<string, unknown> }>;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The view's data-model entry when `entity_type` is `view` and `config.view.<bundle>` exists. */
export function viewDef(model: Record<string, unknown>, entityType: string, bundle: string): ViewDef | undefined {
  if (entityType !== 'view') return undefined;
  const config = isObj(model.config) ? model.config : undefined;
  const views = config && isObj(config.view) ? config.view : undefined;
  const def = views?.[bundle];
  return isObj(def) ? (def as unknown as ViewDef) : undefined;
}

/** JSONata bindings a view mapping evaluates with: `$view` is the view's data-model entry. */
export function viewBindingsFor(
  model: Record<string, unknown>,
  entityType: string,
  bundle: string,
): { view: ViewDef } | undefined {
  const def = viewDef(model, entityType, bundle);
  return def ? { view: def } : undefined;
}
