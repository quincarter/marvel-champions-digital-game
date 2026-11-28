# mc-pool-list

The card pool as one native scroller of cards (Card view) or rows (List view), windowed so a pool of thousands costs what a screen of them does. Columns follow the list own width. rectOfIndex and scrollToIndex answer for cards that are not built.

```html
<mc-pool-list></mc-pool-list>
```

| Property | Type          | Notes                                                                 |
| -------- | ------------- | --------------------------------------------------------------------- |
| model    | PoolListModel | view, count, cardAt, cardScale, rowHeight, thumbWidth, desktop, empty |

| Event           | Detail                                 |
| --------------- | -------------------------------------- |
| mc-deck-builder | from cells and rows: open, add, remove |
| mc-window       | the built cards changed                |

Focus stops: card:<id> (built cards)

Uses: mc-windowed-list (@mc/ui), mc-pool-cell, mc-pool-row

The parent imports `mc-pool-list/mc-pool-list` once; shared `@mc/ui` elements are defined by the ui entry.
