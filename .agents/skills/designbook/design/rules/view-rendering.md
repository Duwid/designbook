---
trigger:
  steps: [design-screen:intake, design-entity:intake, design-component:intake, design-shell:intake, create-sample-data, map-entity, write-scene]
---

# View Rendering

A View (`config.view.<id>`, schema `ViewBundle`) is a listing: it renders records of its row
bundle (`row`) in the row view mode. Its sample pool `view.<id>` holds result records, one per
displayed state (see the sample-data rule `view-result.md`).

## Renderable Closure

A rendered View — main content or block — brings:

- its row bundle with the row view mode into `entity_mappings`, next to the View's own mapping;
- its row bundle and its result pool `view.<id>` into `sample_data_bundles`, the row bundle first.

## Scene Node

`entity: "view.<id>"` selects one result record with `record:` or `select:` — the displayed
state of the listing (e.g. `filled` or `empty`), whose `rows` the View mapping renders.

## Mapping

A View mapping is a field-map mapping for `config.view.<id>`. `component` is the wrapper
component, and each binding's `field` names a view part instead of a data-model field:

| View part | Binds to |
|---|---|
| `rows` | slot; renders each row id of the result record in the row bundle and view mode, no `entity` |
| `title`, `header`, `footer`, `empty` | prop or slot |
| `pager`, `items_per_page`, `total`, `page`, `exposed_sorts` | prop |
| `settings` | prop; `path` is the key path inside the mode's `settings` |
