# mc-trophy-list

The Trophy Room's list in one natively scrolling column: a `mc-trophy-family` heading per family and, under an open family,
a `mc-trophy-tile` per achievement (inside Mods, a `mc-trophy-group` label per pack). A tap on a heading or a card (or the
route's Enter) raises `mc-trophy-room` `{ type: "family" | "achievement", id }` through a `FeatureRelay`. Stops: `sec:<id>`,
`row:<id>`; a pack label is not a stop.

| Property | Type                         |
| -------- | ---------------------------- |
| `model`  | `TrophyListModel` (`.types`) |
| `phone`  | boolean (attribute)          |

`scroller` is the scrolling box. `trophyKeyOf(row)` (in `.types`) is a row's stop key. Needs `@mc/ui` defined.
