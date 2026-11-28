# mc-trophy-filters

The bar under the Trophy Room's rank header: the Filters button (the sort in force on it, Y on a pad) beside Expand all /
Collapse all (R3), and, while it is open, the four sorts and the two directions as chips (`mc-chip`: the chosen one is
filled, and says so in words). Stops: `filters-toggle`, `expand-all`, `sort:<category|completion|points|name>`, `dir:asc`,
`dir:desc`.

| Property | Type                                    |
| -------- | --------------------------------------- |
| `model`  | `TrophyFiltersModel \| null` (`.types`) |

Events: `mc-trophy-room` `{ type: "filters-toggle" }`, `{ type: "expand-all" }`, `{ type: "sort", sort }`,
`{ type: "direction", descending }` (the chips' go through a `FeatureRelay`). Needs `@mc/ui` defined.
