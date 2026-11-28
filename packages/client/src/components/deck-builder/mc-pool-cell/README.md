# mc-pool-cell

One card of Card view: scan with a cost pip, name and caption, and a copy strip. A tap on the picture or caption opens Inspect; a card with copies wears a heavier red frame. It is the card:<id> stop: Enter adds a copy, Inspect opens the card.

```html
<mc-pool-cell></mc-pool-cell>
```

| Property | Type          | Notes                       |
| -------- | ------------- | --------------------------- |
| model    | PoolCardModel | every word already resolved |

| Event           | Detail            |
| --------------- | ----------------- |
| mc-deck-builder | open, add, remove |

Focus stops: card:<id>

Uses: mc-card-art (@mc/ui), mc-copy-buttons

The parent imports `mc-pool-cell/mc-pool-cell` once; shared `@mc/ui` elements are defined by the ui entry.
