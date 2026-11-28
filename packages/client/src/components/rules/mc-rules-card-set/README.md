# mc-rules-card-set

One encounter set of the Card list: a Bangers heading with a rule filling its row, over a wrapped grid of card tiles (a scan, a name, one border). Each tile is a focus stop, `row:card:<set>:<card>`, opening Inspect on a tap, a hold or Enter, and a mouse over it opens the card hover popover. Tiles are lightweight buttons, not an element each, and the browser skips drawing a set far off screen (`content-visibility: auto`), so a thousand of them scroll.

## Properties

| Name  | Type                | Meaning                    |
| ----- | ------------------- | -------------------------- |
| `set` | `RulesCardSetModel` | The heading and its tiles. |

## Events

`mc-rules` `{ type: "card", key }`. Custom properties: `--card-scale` (the Card size setting), `--caption` (the name strip's height).
