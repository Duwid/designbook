/**
 * Entity Builder — resolves `type: 'entity'` nodes using JSONata expressions.
 *
 * Loads entity-mapping .jsonata files, evaluates them against sample data records,
 * and returns raw ComponentNode/SceneNode output.
 * resolveEntityRefs() in the registry handles recursive resolution afterward.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import jsonata from 'jsonata';
import type {
  SceneNodeBuilder,
  SceneNode,
  BuildContext,
  RawNode,
  BuildResult,
  FieldMapping,
  EntityOrigin,
} from '../types';
import { extractFieldMappings } from '../jsonata-mapping-analyzer';
import { viewBindingsFor } from '../../shared/view-bindings';

/**
 * Placeholder ComponentNode returned when JSONata file or sample data is missing.
 */
function missingPlaceholder(message: string): RawNode {
  return {
    component: 'designbook:placeholder',
    props: { message },
  };
}

export const entityBuilder: SceneNodeBuilder = {
  appliesTo(node: SceneNode): boolean {
    // YAML duck-typed: { entity: "node.article", ... }
    // Normalized (from JSONata): { type: 'entity', entity_type: '...', bundle: '...' }
    return ('entity' in node && typeof node['entity'] === 'string') || node.type === 'entity';
  },

  async build(node: SceneNode, ctx: BuildContext): Promise<BuildResult> {
    // Support raw YAML format: { entity: "node.article", view_mode, select }
    // as well as normalized format: { entity_type, bundle, view_mode, select }
    let entity_type: string;
    let bundle: string;
    if (typeof node['entity'] === 'string') {
      const parts = (node['entity'] as string).split('.');
      entity_type = parts[0] ?? '';
      bundle = parts[1] ?? '';
    } else {
      entity_type = (node['entity_type'] as string) ?? '';
      bundle = (node['bundle'] as string) ?? '';
    }
    const view_mode = (node['view_mode'] as string) ?? '';
    const form_mode = (node['form_mode'] as string) ?? '';
    const select = (node['select'] as string) ?? '';

    // 1. Locate the .jsonata expression file. A `form_mode` resolves from the
    //    sibling `form-mapping/` directory (the editing half of the bundle);
    //    otherwise the view path is byte-identical to before.
    const jsonataPath = form_mode
      ? resolve(ctx.designbookDir, 'form-mapping', `${entity_type}.${bundle}.${form_mode}.jsonata`)
      : resolve(ctx.designbookDir, 'entity-mapping', `${entity_type}.${bundle}.${view_mode}.jsonata`);
    const mappingLabel = form_mode
      ? `${entity_type}.${bundle}.${form_mode}.jsonata (form)`
      : `${entity_type}.${bundle}.${view_mode}.jsonata`;

    const entity: EntityOrigin = { entity_type, bundle, view_mode, select, mapping: jsonataPath };
    if (form_mode) entity.form_mode = form_mode;
    const meta = { kind: 'entity' as const, entity };

    if (!existsSync(jsonataPath)) {
      console.warn(`[Designbook] JSONata expression not found: ${jsonataPath}`);
      return { nodes: [missingPlaceholder(`missing expression: ${mappingLabel}`)], meta };
    }

    // 2. Get the bundle's record array — content first, config fallback.
    const entityArray = (ctx.sampleData?.content?.[entity_type]?.[bundle] ??
      ctx.sampleData?.config?.[entity_type]?.[bundle] ??
      []) as Record<string, unknown>[];

    // Resolve the record: a `select` JSONata predicate over the array (`$`) takes
    // precedence; otherwise `record` indexes the bundle's pool array, defaulting to 0
    // (for a View the pool is its result records in data/view.<id>.yml).
    const record = node['record'];
    let recordData: unknown = {};
    if (select) {
      const selected = await jsonata(select).evaluate(entityArray);
      recordData = selected ?? {};
    } else {
      recordData = entityArray[typeof record === 'number' ? record : 0] ?? {};
    }

    // 3. Compile and evaluate the JSONata expression. A View mapping reads its config
    //    (title, pager, empty text, …) through `$view`, the view's data-model entry.
    const source = readFileSync(jsonataPath, 'utf-8');
    const expr = jsonata(source);
    const bindings = viewBindingsFor(ctx.dataModel as unknown as Record<string, unknown>, entity_type, bundle);
    const result = await expr.evaluate(recordData, bindings);

    // 3b. Extract field mappings from the JSONata AST
    let fieldMappings: FieldMapping[] | undefined;
    try {
      fieldMappings = extractFieldMappings(source);
    } catch {
      // Non-critical — panel just won't show mappings
    }
    if (fieldMappings?.length) {
      entity.fieldMappings = fieldMappings;
    }

    if (!result) {
      console.warn(`[Designbook] JSONata expression returned empty: ${jsonataPath}`);
      return {
        nodes: [missingPlaceholder(`expression returned empty: ${mappingLabel}`)],
        meta,
      };
    }

    // 4. Return raw result — may contain type:'component' and type:'entity' entries.
    //    resolveEntityRefs() in the registry will recursively resolve type:'entity' entries.
    //    Wrap single objects (e.g. view entity JSONata) in an array.
    const nodes = (Array.isArray(result) ? result : [result]) as RawNode[];
    return { nodes, meta };
  },
};
