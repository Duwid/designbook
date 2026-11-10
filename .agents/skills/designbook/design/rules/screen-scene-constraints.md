---
trigger:
  steps: [write-scene]
---

# Screen Scene Constraints

Apply only when the task parameter `scene_scope = screen`, including consumer writes originating in another workflow. Other scene scopes skip this rule.

## Rules

- **Shell inheritance** -- scene items MUST start with `scene: design-system:<shell_name>` (normally `scene: design-system:shell`) and fill the `content` slot via `with:`. The ref source is the literal `design-system` — the location of the shell scenes file — **NOT** the shell SceneFile's `id:` (`debo-design-system`). Using the `id` as the source (`debo-design-system:shell`) fails to resolve and the screen renders empty.
- **`group:`** must be `"Designbook/Sections/{{ section_title }}"`
- **`id:`** must match `{{ section_id }}`
- ⛔ **Scene `name:` must NOT be `overview`** (case-insensitive). `overview` is reserved: every scenes file already exports an `overview` story (the section overview/management page). A scene named `overview` produces a second `export const overview` in the same module, collides with the reserved one, and silently renders the section page instead of the scene. Name scenes meaningfully — by the section or screen purpose (e.g. the `{{ section_id }}` or `default`) — **never** the screen *type* word `overview`. (Enforced by the `scene` validator.)

## Main content — the route-bearer

A screen scene answers one question: *what is this page?* Exactly one node in the page
`content` slot answers it. That node is the **main content**, and it carries the route.

- The page `content` slot carries **exactly one** route-bearing **main content**. Zero main
  content is an error — the page bears no route. Two is an error — the route is ambiguous.
- The main content is a single **Entity** (a route-bearing content entity, addressed as
  `entity: "<entity_type>.<bundle>"`) **or** a **View** (a listing that owns a route, addressed
  as `entity: "view.<id>"`). A route-bearing View is a `display: page` View in the data model
  (`config.view.<id>.display`); a `display: block` View is a block. A component or decorative
  widget is never the main content — it bears no route.
- Every other node in `content` is a **block** — beiwerk that carries no route and stands beside
  the main content, never in place of it. This rule decides only *which* node is a block; **how a
  block is realized and typed on the backend is a backend concern** — the backend's block rules
  read the data model to type each block, and may report a block whose type the model does not
  determine.
- A listing of several contents is a **View**. The sole exception is a listing that runs under an
  entity through an entity-reference field: there the parent entity renders its own references
  (see [entity-reference-rendering.md](entity-reference-rendering.md)), and the items live inside
  the entity's own subtree, not as siblings in `content`.
- `records:` is a demo shorthand that repeats one entity across sample indices; a real listing is
  a **View**. (The schema states the same at `EntityNode.records` — this is the rule that governs
  the scene build.)
- Every **entity** node — the main content or a block, a single entity or a View — selects its
  sample record with `record:` (an index) or `select:` (a predicate). A View's record is one of
  its result records in `data/view.<id>.yml`: the displayed state of the listing (e.g. `filled`
  or `empty`), whose `rows` the View mapping renders.
- The originating intake labels the main content in its structure preview, so the user
  approves which node bears the route before the scene is built.

## Output Structure

```yaml
id: {{ section_id }}
title: {{ section_title }}
description: {{ section_description }}
status: planned
order: [number]

group: "Designbook/Sections/{{ section_title }}"
scenes:
  - name: "[screen-name — meaningful, NOT 'overview'; e.g. the section id or 'default']"
    items:
      - scene: "design-system:shell"
        with:
          content:
            # exactly one route-bearing main content — an Entity …
            - entity: "[ENTITY_TYPE].[ENTITY_BUNDLE]"   # the route-bearer
              view_mode: "[VIEW_MODE]"
              record: 0                                 # a direct entity MUST pick its record (or use `select:`)
            # … or a View (entity: "view.[VIEW_ID]", display: page) — never both; its record picks the result state
            # every further node is a block beside the main content — an entity block picks a record too
            - entity: "[BLOCK_ENTITY_TYPE].[BLOCK_BUNDLE]"
              view_mode: "[VIEW_MODE]"
              record: 0
            # … or a component block:
            - component: "$DESIGNBOOK_COMPONENT_NAMESPACE:some-block-component"
              slots: ...
```
