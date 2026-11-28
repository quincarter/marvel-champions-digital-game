# mc-seats-filters

The filters row of Take your seats, over the hero roster: search field, quick-filter chips and the Random / art /
Use preconstructed buttons. A narrow screen hides the field behind a magnifier toggle and the chips behind a Filters button
(the model says which are shown). It holds no state: each press is an event, and the scene answers with a new `model`.

```
mc-seats-filters
  .bar:  .loupe (button) · mc-button.filters · mc-search-field (@mc/ui) · mc-seats-buttons
  mc-seats-chips   ->  mc-tip-chip (@mc/ui) per chip
  mc-tip-plate (@mc/ui)  only while a tip is open
```

```html
<mc-seats-filters .model="${filters}"></mc-seats-filters>
```

| Property | Type                                   | Notes                                       |
| -------- | -------------------------------------- | ------------------------------------------- |
| `model`  | `SeatsFiltersModel` (`seats.types.ts`) | words arrive translated; null draws nothing |

| Event             | Detail                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `mc-seats`        | `search {text}`, `toggle {what: "search" \| "filters"}`, `chip {id}`, `chip-info {id}`, `tip-link`, `action {action}` |
| `mc-search-focus` | from the field (composed): `{ focused }`, so the route stands aside while the caret is in it                          |

The open tip is a plate over the whole screen: a tap on the backdrop shuts it (`chip-info` for the open chip) and presses
nothing underneath. Placement follows the old `tipPlacement` rules (`@mc/ui` `mc-tip-plate`).

Focus stops: `hero-search-toggle`, `filters-toggle`, `hero-search`, `hero-chip:<id>`, `hero-chip-info:<aspect>`,
`hero-random`, `hero-art`, `preconstructed`, and the open tip link `aspect-tip-link`.

The page must define `@mc/ui` (`import "@mc/ui"`, once at app boot) and import `mc-seats-filters/mc-seats-filters` once.
