# mc-seats-chips

The quick-filter chips of Take your seats: aspects (each with an "i" that opens its tip), deck sources and Playable now.
Wrapped rows on a wide screen, or with `rail` one row that scrolls sideways. Each chip is an `mc-tip-chip` (`@mc/ui`).

```html
<mc-seats-chips .chips="${chips}" ?rail="${narrow}"></mc-seats-chips>
```

| Property | Type                                        | Notes                         |
| -------- | ------------------------------------------- | ----------------------------- |
| `chips`  | `FilterChip[]` (`@mc/ui`), empty draws none | words arrive translated       |
| `rail`   | boolean                                     | one sideways row, not wrapped |

| Event      | Detail                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------- |
| `mc-seats` | `{ type: "chip", id }` (the body) or `{ type: "chip-info", id }` (the "i"), `id` the chip id |

Method: `infoElementOf(id)` resolves to the chip's "i" segment once drawn (where a tip points), or null.

Focus stops: `hero-chip:<chip id>` and, on a chip with an "i", `hero-chip-info:<aspect>`.
