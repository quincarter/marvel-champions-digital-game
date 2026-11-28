# mc-decks-list-filters

The deck list's search field and Filters button on one row, then the quick-filter chips while the button has them open.

| Property | Type                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| `model`  | `DecksListFiltersModel`: the `search`, `filtersLabel`, `filtersOpen`, `chips` of `DecksListModel` |

| Event             | Detail                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `mc-decks`        | `{ type: "search", list: "deck", text }`, `{ type: "chip", list: "deck", id }`, `{ type: "action", action: "filters-toggle" }` |
| `mc-search-focus` | `{ focused }`, from the field (composed)                                                                                       |

The search `value` is the text the screen accepted, never the field's live draft. `field` gives the search element.

Focus stops: `deck-search`, `filters-toggle`, `deck-chip:<chip id>`.
