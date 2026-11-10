---
type: data-mapping
name: views
priority: 10
trigger:
  domain: data-mapping
  config_name: 'views.view.*'
filter:
  backend: drupal
---

# Blueprint: View Mapping and Views Config

Applies when `map-entity` runs for a View (`entity_type: view` — a `config.view.<id>` bundle). The
same blueprint also binds the view's Drupal config at `sync-to:transform` through its
`trigger.config_name: 'views.view.*'` — the config-name binding `form-display` and
`layout-builder-display` use — so a view binds like the other displays, not by prose alone.

## A view mapping is a wrapper with view-part bindings

A View has no fields. Its mapping places one **wrapper component** and binds the view's fixed
parts to the wrapper's props and slots — exactly the `bindings` of the map-entity task. The
`expected_mapping` from `plan instructions` is the submission.

- `rows` → the wrapper's rows slot. Each row renders the view's `row` bundle in the row view
  mode; the binding names no `entity`.
- `title`, `header`, `footer`, `empty` → a prop or a slot of the wrapper; `empty` renders only
  when the result has no rows.
- `pager`, `items_per_page`, `page`, `total` → scalar props. The wrapper renders its own pager
  and count from them; a result count such as "(12)" binds `total` to a prop.
- `exposed_sorts` → one array prop of `{value, label}` options.
- `settings` + `path` → a prop fed from the mode's style options (e.g. `columns`).

Config parts read the view's data-model entry as `$view`; result parts read the selected result
record of `data/view.<id>.yml`. The mapping carries no literals — the data model stays the single
source of what the view shows.

```jsonata
(
  $fields := $;
  [
    {
      "component": "<namespace>:<wrapper>",
      "props": {
        "title": $view.title,
        "count": $exists($fields.total) ? $fields.total : $count($fields.rows)
      },
      "slots": {
        "rows": [$map($fields.rows, function($id) { { "entity": "<row_entity_type>.<row_bundle>", "view_mode": "<row_view_mode>", "record": $lookup(<row pool index>, $string($id)) } })],
        "empty": $count($fields.rows) = 0 ? $view.empty
      }
    }
  ]
)
```

A scene node `entity: view.<id>` selects its displayed state with `record:` — the filled and the
empty listing are two result records of one view, rendered by the same mapping.

## The view's `template` is its style

`view_modes.default.template` names the view's style (`list-view`, `grid`, …) and its
`settings` the style options (e.g. `columns`). The wrapper component is chosen by the mapping,
independent of the style value; the style value and options reach Drupal through the views
config below.

## The view's build form decides the wrapper owner

A view's `build_form` (the same backend-neutral `template` axis every other surface uses, sourced
from `entity_mapping.templates`) splits into two branches. Resolve the branch first — it decides
whether a view-presenter exists at all.

### Branch: Display Builder

When the view's page build form is a Display Builder form, the view binds **directly** through
the Display Builder page config — the same mechanism a Canvas or Layout-Builder page uses for its
own build form. The concrete config owner is the page's own config entity (the `page_layout`-style
config the Display Builder build form emits), carrying the view binding inline or by reference.

**No view-presenter exists in this branch.** The view wrapper, its rows, its pager, and its
exposed filter are all expressed through that one config owner — there is no separate Twig
wrapper to author.

### Branch: without Display Builder

Without a Display Builder build form, the view wrapper **is** a presenter-template: theme methods
are the only way to produce the wrapper markup, so `sync-to` generates a presenter-template
(Twig) for it. That presenter-template **composes** the wrapper component the view mapping names
(read from `entity-mapping/view.<id>.<mode>.jsonata`) and fills each bound part from the Drupal
view:

- **rows** — the rendered rows, into the rows slot;
- **title / header / footer / empty** — the view title and area output, into their prop or slot;
- **pager / items_per_page / page / total** — the pager values, as the wrapper's scalar props;
- **exposed form** — the exposed-filter form markup, when the wrapper has a slot for it.

The presenter-template's only job is composition — routing each already-rendered region or value
into its prop or slot. It never rebuilds a region's markup itself. The pager markup, where the
theme renders one, comes from its own Pager presenter.

## Container ownership

Exactly one owner sits beneath the view entity — the Display Builder config owner in that branch,
or the presenter-template wrapper in the other. A Scene that renders a view carries the view
entity **unwrapped**: the Scene node names the view; it does not itself introduce a second
container around it. Whichever branch applies supplies the one container the rendered view lives
in.

## A view's display decides its role

The same view can be a page's main content or beiwerk beside it — its `display` decides:

- `display: page` owns a route (`path`) and can be a screen's route-bearing main content.
- `display: block` (`views_block:*`) owns no route; it is a block that sits beside the main
  content.

## Drupal config export — the `### to_drupal` pattern

At `sync-to:transform` this blueprint authors `views.view.<id>` from the unit's `def` (the
`config.view.<id>` entry). `prepared` (the prepare-fetched schema) is authoritative for the shape;
the mapping below is the starting point, not a fixed key layout.

- `id`, `label` ← the key and `label`; `base_table` / `base_field` ← the `row.entity_type`'s data
  table and id (e.g. `node_field_data` / `nid`).
- `display` + `path` → one display beside `default`: `page_1` (`display_plugin: page`, `path`)
  or `block_1` (`display_plugin: block`).
- `title` → `display_options.title`.
- `pager` → `display_options.pager`: `type` (`full`, `mini`; `none` with `items_per_page` becomes
  `some`) and `options.items_per_page`.
- `empty`, `header`, `footer` → an `area_text_custom` handler each under `display_options.empty`,
  `header`, `footer`.
- `sorts` → `display_options.sorts`, one handler per entry with `order`; an exposed sort sets
  `exposed: true` and `expose.label`.
- `filters` → `display_options.filters`, one handler per field (e.g. `status`, `type` for the
  row bundle).
- `row` → `display_options.row`: plugin `entity:<row.entity_type>` with
  `options.view_mode: <row.view_mode>`; the row bundle's own display renders each row.
- `view_modes.default.template` + `settings` → `display_options.style`: the style plugin that
  renders the wrapper component of the view mapping through UI Patterns
  (`{component_id, variant_id, props, slots}`, rows into the rows slot), with `settings` as its
  options.

Which unit emits the **wrapper** — the Display Builder page config, or a generated
presenter-template — follows the build-form branch above. Result records in `data/view.<id>.yml`
are sample data for the render and never sync.
