# mc-seats-detail

The hero detail and insights panel of Take your seats: an ink panel with the active seat's note, the hero's facts
(`mc-detail-hero`, which holds two `mc-detail-fact`s) or the empty words before a hero is chosen, and the insight lines
(`mc-detail-insights`). It fills its box and scrolls natively when the words are taller than it. The scene rebuilds
`model` as the pointer or focus moves over the roster (the insights follow the hero in hover or focus).

```html
<mc-seats-detail .model="${detailModel}"></mc-seats-detail>
```

| Property | Type                                          | Notes                                       |
| -------- | --------------------------------------------- | ------------------------------------------- |
| `model`  | `SeatsDetailModel \| null` (`seats.types.ts`) | words arrive translated; null draws nothing |

Words only: no events and no focus stops.

Tree: `mc-seats-detail` > `mc-detail-hero` > `mc-detail-fact` (obligation, nemesis); `mc-seats-detail` >
`mc-detail-insights` (`meta` lines, and `caution` lines with a leading "!").
