---
trigger:
  domain: data-model
filter:
  backend: drupal
---

# Rule: Drupal Views

A View is declared once, as `config.view.<id>` (schema `ViewBundle`). That one entry drives the
Storybook render and the `views.view.<id>` sync; no second `views.view.<id>` config key exists.

## Rules

- A view the site lists content with names its row bundle and row view mode in `row`; the row
  bundle is a content bundle with that view mode.
- A view that is a screen's main content has `display: page` and a `path`; a view placed beside
  the main content has `display: block`.
- `view_modes.default.template` is the view's style value (e.g. `list-view`, `grid`); style
  options such as columns go into its `settings`.
- Title, pager, empty/header/footer text, sorts and filters live on the view entry. The rows a
  view shows are its result sample records in `data/view.<id>.yml`, never part of the data model.

```yaml
config:
  view:
    news:
      label: News
      display: page
      path: /news
      title: Latest news
      row: { entity_type: node, bundle: article, view_mode: teaser }
      pager: { type: full, items_per_page: 10 }
      empty: No news yet.
      sorts:
        - { field: created, order: DESC }
      filters: { status: 1 }
      view_modes:
        default: { template: list-view, settings: { columns: 3 } }
```
