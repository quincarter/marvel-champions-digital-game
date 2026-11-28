# mc-decks-pool-cell

One card of the card pool (a `McPress`): the scan fitted whole, a cost pip, the name, the type line with how many the deck holds,
and a "x2" mark with a heavier frame when the deck holds any.

| Property | Type                 | Notes                                                              |
| -------- | -------------------- | ------------------------------------------------------------------ |
| `card`   | `DecksPoolCard`      | already worded                                                     |
| `shown`  | boolean (attribute)  | the card the stats pane shows: the heavier frame                   |
| `stop`   | string (`data-stop`) | the focus stop (the grid leaves it off: the scene makes the stops) |

| Event                                                   | Detail                        | When                               |
| ------------------------------------------------------- | ----------------------------- | ---------------------------------- |
| `mc-pressed`                                            | `{ action: <card id>, hold }` | a tap, or `click()` from the route |
| `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect` | see `watchCard`               | the picture                        |

CSS: `--cell-width`, `--art-height`, `--caption-height` (from the grid).
