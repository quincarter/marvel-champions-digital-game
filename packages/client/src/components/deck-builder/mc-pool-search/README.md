# mc-pool-search

The pool search row: a real input with its own clear button, the ? that opens the cheat sheet and the Cards / List view toggle. The field keeps the text the screen accepted, never a live draft.

```html
<mc-pool-search></mc-pool-search>
```

| Property | Type            | Notes                                               |
| -------- | --------------- | --------------------------------------------------- |
| model    | PoolSearchModel | text, placeholder, clearLabel, helpLabel, viewLabel |

| Event           | Detail                                  |
| --------------- | --------------------------------------- |
| mc-deck-builder | search { text }, search-help, pool-view |

Focus stops: filter-text, filter-clear, filter-help, pool-view

Uses: mc-search-field, mc-button (@mc/ui)

The parent imports `mc-pool-search/mc-pool-search` once; shared `@mc/ui` elements are defined by the ui entry.
