---
trigger:
  domain: sample-data
---

# Rule: View Result Records

A View (`config.view.<id>`) has no fields. Its sample pool `view.<id>` holds **result records**:
each record is one displayed state of the listing, and its values follow the `ViewResult` schema
(`rows`, optional `total`, `page`). The scene node `entity: view.<id>` selects a state with
`record:`.

- Plan one record per state the screen shows, with a meaningful id — e.g. `filled` (the typical
  page) and `empty` (`rows: []`, so the view's `empty` text renders).
- `rows` lists ids of records in the view's row bundle (`config.view.<id>.row`), in display order.
  Each id exists in that bundle's pool, so the row bundle's pool is planned before the result
  pool.
- `total` is the result count across all pages when the listing is paged; leave it out when it
  equals the row count.
- View config — title, pager, empty text, sorts — stays in the data model; a result record carries
  only what varies per state.

## Checks

| ID | Severity | What to verify | Where |
|---|---|---|---|
| VR-01 | error | Every `view.<id>` record carries `rows` as an array of row-bundle record ids that exist in the row pool | records.values |
| VR-02 | warning | `total`, when present, is at least the number of `rows` | records.values |
