# mc-decks-cards

The "Card pool" section of Decks & Collection: the heading with the filter chips (a phone folds them behind a Filters
button), the text search and the selected deck's cards as a windowed grid (`mc-decks-pool-grid`), or one line saying why there
are none (no deck selected, no match, still searching).

| Property | Type                                 |
| -------- | ------------------------------------ |
| `model`  | `DecksCardsModel` (`decks.types.ts`) |

| Event             | Detail                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `mc-decks`        | `{ type: "chip" \| "search", list: "pool", ... }`, `{ type: "action", action: "pool-filters-toggle" }`, `{ type: "card", ... }` |
| `mc-search-focus` | `{ focused }`, from the field (composed)                                                                                        |

`grid` gives the grid (its `cellRect` and `scrollToIndex` make the cards' stops); `field` gives the search element.

Focus stops: `pool-chip:filters`, `pool-chip:<chip id>`, `pool-search`.
