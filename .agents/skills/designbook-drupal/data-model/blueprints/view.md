---
type: entity-type
name: view
priority: 10
trigger:
  domain: data-model
filter:
  backend: drupal
---

# Entity Type: view

A view lives under `config.view.<id>`; its shape is the core `ViewBundle` schema. It has no
fields — the rows it lists are its result sample records in `data/view.<id>.yml`.

## Drupal Config Export Pattern

The concrete `.jsonata` is authored per config-name task against the prepare-fetched schema.

**Input:** `{ key, def }` — `key` is the view id, `def` the `ViewBundle` entry.

**Output config-name unit:** `views.view.<key>` — one Views config entity with `id` and `label`,
module dependency `views`, a `default` display and one `page_1` or `block_1` display per
`def.display`. The views data-mapping blueprint maps each `def` key to its display options.

All emitted units carry `langcode: "en"`, `status: true`, and a `dependencies` object.
