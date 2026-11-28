# mc-past-games-filters

The tabs along the top of Past games: All, Wins, Losses, each with its count, as an `mc-tab-rail` (`prefix="filter:"`, so the
stops are `filter:all`, `filter:won`, `filter:lost`). On a pad the LB / RB glyph hangs under the strip's right end
(`mc-glyph-hint`).

| Property   | Attribute  | Type                        |
| ---------- | ---------- | --------------------------- |
| `tabs`     | -          | `TabRailTab[]`              |
| `selected` | `selected` | `all`, `won` or `lost`      |
| `glyph`    | -          | `ControlGlyph` or undefined |

Event: `mc-past-games` `{ type: "filter", filter }`. Needs `@mc/ui` defined.
