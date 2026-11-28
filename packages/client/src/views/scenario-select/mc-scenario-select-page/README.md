# Choose a scenario (page)

`<mc-scenario-select-page>`

The whole Choose a scenario screen as one element that only composes sections. `ScenarioSelectScene` mounts it with
`mountElement`, sets `model` (`ScenarioSelectPageModel`) and listens for `mc-scenario-select`.

## Tree

```
mc-scenario-select-page
  mc-top-bar                       (@mc/ui: Back, title, step; Back is the `back` stop)
  mc-scenario-filters
    mc-search-toggle               (@mc/ui)   scenario-search-toggle
    mc-search-field                (@mc/ui)   scenario-search
    mc-scenario-inspect-hint
    mc-hint-button                 (@mc/ui)   filters-toggle
    mc-scenario-chips
      mc-filter-chip               (@mc/ui)   scenario-chip:<id>
  mc-scenario-shelves
    mc-scenario-random-row         drill-back, random-box, random-scenario, random-villain
    mc-shelf-roster                (@mc/ui)   scenario:<id>, scenario-shelf:<id>, scenario-clear
  mc-scenario-stats                (wide: under the shelves)
    mc-scenario-stat-cell
  mc-scenario-picked               stages-toggle (narrow)
    mc-scenario-stage, mc-scenario-record, mc-scenario-set-block
    mc-scenario-stats              (narrow: inside the open sheet)
  mc-scenario-actions              customize, next
```

## Properties

| Name    | Kind      | What it is                                                         |
| ------- | --------- | ------------------------------------------------------------------ |
| `model` | property  | `ScenarioSelectPageModel`                                          |
| `wide`  | attribute | Set from the model: two columns (list beside the ink stages panel) |
| `phone` | attribute | Set from the model: the phone's taller bar and tighter gutters     |

## Events

- `mc-scenario-select`: `ScenarioSelectDetail` (`press` / `tile` / `inspect` / `search`), raised by any section. One name
  for the feature, listed in `GUARDED_EVENTS`.
- `mc-image-error`, `mc-card-hover`, `mc-card-hover-end` pass through from the shelf tiles.

## Layout

CSS only (`responsive.styles.ts` and the page's own styles): a grid of the bar over the body; the body is two columns wide
or one stacked column narrow. A narrow open stages sheet covers the list (`data-covered`), which keeps its box and scroll.
