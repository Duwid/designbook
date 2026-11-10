.# Sample Data Format Reference

## File Structure

`data.yml` has two optional top-level buckets: `content:` and `config:`. Both use the **identical nested structure**:

```
content:              config:
  entity_type:          entity_type:
    bundle:               bundle:
      - id: "..."           - id: "..."
        field: value          field: value
```

The generation logic is the same for both buckets. Differences between entity types come exclusively from **field types** and **`sample_template`** declarations — not from which bucket they live in.

```yaml
content:
  node:
    article:
      - id: "1"
        title: Adopting a Senior Dog
        field_author: "author-1"        # plain string ID reference
  taxonomy_term:
    author:
      - id: "author-1"
        name: Dr. Lena Hartmann
        field_role: Veterinarian

config:
  view:
    article_listing:            # View result records (ViewResult), one per displayed state
      - id: filled
        rows: ["1", "2"]        # plain ids of the view's row bundle (node.article)
        total: 14
      - id: empty
        rows: []
```

## Generation Order

Generate `content:` entities first, then `config:` entities. A View result record lists row ids of a content bundle — that bundle must exist before config generation begins.

```
Pass 1 → all content: bundles
Pass 2 → all config: bundles
```

## Entity References

Every reference is a **plain string id** of the target record — in content fields and in View rows alike:

### Plain string ID (content entity fields)

Reference fields on `content:` entities store the target record's `id` as a plain string:

```yaml
content:
  node:
    pet:
      - id: pet-1
        field_shelter: shelter-1        # ← plain string ID
        field_category: cat-dogs        # ← plain string ID
```

The validator checks these by matching against `id` fields in the target bundle.

### View rows (plain ids)

A View result record lists its rows as plain ids of the view's row bundle (`config.view.<id>.row`), like a multi-value reference field. The view config — title, pager, empty text — stays in the data model; the result record carries only `rows`, `total` and `page`.

```yaml
config:
  view:
    pet_listing:
      - id: filled
        rows: [pet-1, pet-2]     # ← ids in content.node.pet
```

## Field Templates

Fields may declare `sample_template` in `data-model.yml` to control value structure:

```yaml
components:
  type: component_tree
  sample_template:
    template: canvas
```

**Precedence** (highest to lowest):
1. `sample_template.template` — explicit template → loads rule `when: template: <name>`
2. `field_type` rule — no `sample_template` but rule exists `when: field_type: <type>` → auto-applied
3. Plain string — fallback when no template or rule matches

### Built-in templates

| Template | Generates | Used for |
|----------|-----------|----------|
| `canvas` | Component tree with slots and props | `canvas_page` components field |
| `layout-builder` | Region and block placements | Layout Builder page components |

Backend-specific templates (e.g. `formatted-text`, `link`, `image`) are provided by backend skills such as `designbook-drupal/sample-data/`.

## Content Guidelines

- Create 5–10 records per entity (enough for lists, pagination, empty states)
- Use realistic, varied content — no "Lorem ipsum"
- Include edge cases: long names, empty optional fields, different statuses
- Vary content across records (different lengths, categories, authors)
- Reference fields should form a realistic web of relationships
