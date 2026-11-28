# mc-past-games-list

The finished games, newest first, in a natively scrolling column of `mc-past-game-row`s, or one sentence in place of rows
(`model.empty`: still reading, no games, nothing matches). A tap on a row (or the route's Enter) raises `mc-past-games`
`{ type: "select", id }` through a `FeatureRelay`. Rows are stops (`game:<id>`).

| Property | Type                            |
| -------- | ------------------------------- |
| `model`  | `PastGamesListModel` (`.types`) |

`scroller` is the scrolling box; `centerRow(id)` scrolls a game's row to the middle. Needs `@mc/ui` defined.
