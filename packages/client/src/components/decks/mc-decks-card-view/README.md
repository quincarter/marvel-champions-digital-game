# mc-decks-card-view

A pool card shown in the stats pane in place of the deck's numbers (#529): a way back, the card's scan with its name and type,
what your games say about it with this hero and with every hero, which of your decks hold it, and Inspect at the foot.

| Property | Type                                    |
| -------- | --------------------------------------- |
| `model`  | `DecksCardViewModel` (`decks.types.ts`) |

| Event                                                   | Detail                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| `mc-decks`                                              | `{ type: "action", action: "card-back" \| "card-inspect" }` |
| `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect` | from the scan (see `watchCard`)                             |

Focus stops: `card-back`, `card-inspect`.
