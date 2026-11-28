# mc-past-games-search

The export button and the search box under the tabs. "Export for MC Tracker (CSV)" writes the games the list shows now; the
field finds a game by hero, villain, deck, a card played or the year. Side by side from 720px of the element's own width (a
container query), else stacked. Stops: `export-tracker`, `search`.

The field is an `mc-search-field`: its `mc-search` / `mc-search-focus` events pass through unchanged (they are guarded by the
panel region already). Hand it the text the screen accepted as `value`, never the field's draft (`field.text`).

| Property | Type                              |
| -------- | --------------------------------- |
| `model`  | `PastGamesSearchModel` (`.types`) |

`field` is the search field (the scene's caret rules). Event: `mc-past-games` `{ type: "export-tracker" }`. Needs `@mc/ui`.
