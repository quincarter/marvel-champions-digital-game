# mc-pool-row

One card of List view: scan, name, type line, why it is offered, up to three lines of rules, and the copies, - and + at the row end. It is the card:<id> stop; its box is the whole list slot so the buttons keep their place.

```html
<mc-pool-row></mc-pool-row>
```

| Property    | Type          | Notes                       |
| ----------- | ------------- | --------------------------- |
| model       | PoolCardModel | every word already resolved |
| thumb-width | number        | picture width px            |

| Event           | Detail            |
| --------------- | ----------------- |
| mc-deck-builder | open, add, remove |

Focus stops: card:<id>

Uses: mc-card-art (@mc/ui), mc-copy-buttons

The parent imports `mc-pool-row/mc-pool-row` once; shared `@mc/ui` elements are defined by the ui entry.
