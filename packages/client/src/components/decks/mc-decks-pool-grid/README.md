# mc-decks-pool-grid

The card pool's cards in a natively scrolling grid that draws only the rows near its window (a spacer as tall as every row, the
rows in view and one above and below under it). The columns come from the grid's own width (`poolGridGeometry`, with the
settings' card size).

| Property    | Type                       | Notes                                  |
| ----------- | -------------------------- | -------------------------------------- |
| `count`     | number                     | how many cards                         |
| `cardAt`    | `(index) => DecksPoolCard` | asked only for the cards in the window |
| `cardScale` | number                     | the card size setting's factor         |
| `topKey`    | number                     | a changed value scrolls to the top     |
| `version`   | string                     | a changed value draws the cells again  |

Methods: `geometry`, `cellRect(index)` (the cell now, in viewport pixels), `scrollToIndex(index)`.

| Event                                                   | Detail                                   |
| ------------------------------------------------------- | ---------------------------------------- |
| `mc-decks`                                              | `{ type: "card", cardId, via: "press" }` |
| `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect` | from a cell's picture (see `watchCard`)  |

Focus stops are made by the scene (`pool-card:<card id>`), one per card, from `cellRect` and `scrollToIndex`.
