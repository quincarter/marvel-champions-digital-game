# mc-seat-summary

The narrow layouts' strip for the active seat: its facts on short lines beside a Clear seat button (the seat chips have no
room for a ✕), or the hint of an empty active seat. With `toggle` it is a disclosure: one quiet button that opens and shuts
the block under it, so the roster keeps the room on a short phone.

```html
<mc-seat-summary .model="${summary}"></mc-seat-summary>
```

| Property | Type                                  | Notes                                                          |
| -------- | ------------------------------------- | -------------------------------------------------------------- |
| `model`  | `SeatSummaryModel` (`seats.types.ts`) | words arrive translated; `toggle: null` shows the block always |

| Event      | Detail                                                 |
| ---------- | ------------------------------------------------------ |
| `mc-seats` | `{ type: "clear-seat" }`                               |
| `mc-seats` | `{ type: "toggle", what: "details" }` (the disclosure) |

Focus stops: `seat-details-toggle` (with `toggle`) and `clear-seat` (a seat with a hero, block open). While the last hero
stays, Clear is `aria-disabled` with `clearBlocked` as its title; the press is still raised for the scene to explain.
