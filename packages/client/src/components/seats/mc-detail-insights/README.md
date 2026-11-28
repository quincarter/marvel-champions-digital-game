# mc-detail-insights

The lines under the hero facts on the Take your seats detail panel: Team-Up pair notes and why the hero in hover or
focus is recommended (tone `meta`), and conflicts (tone `caution`: a leading "!" and a heavier weight, so it is never
colour alone). A polite live region, because the scene rebuilds it as the pointer or focus moves over the roster.

```html
<mc-detail-insights .insights="${[{ text: "Both seats play Spider-Man.", tone: "caution" }]}"></mc-detail-insights>
```

| Property   | Type                                    | Notes                               |
| ---------- | --------------------------------------- | ----------------------------------- |
| `insights` | `{ text, tone: "meta" \| "caution" }[]` | already worded; empty draws nothing |

No events, no stops.
