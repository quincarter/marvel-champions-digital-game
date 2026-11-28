# mc-seat-card

One seat on Take your seats' wide layout: portrait thumbnail, red seat label, Bangers hero name, meta line and (filled) a
clear ✕. The frame says the seat's state without colour: solid red (active, filled), dashed red (active, empty), thin
ink (filled), dashed ink (empty), dashed and dimmed (locked: fill the seat before it first).

```html
<mc-seat-card .model="${seat}"></mc-seat-card>
```

| Property | Type                           | Notes                   |
| -------- | ------------------------------ | ----------------------- |
| `model`  | `SeatModel` (`seats.types.ts`) | words arrive translated |

| Event      | Detail                                                          |
| ---------- | --------------------------------------------------------------- |
| `mc-seats` | `{ type: "seat", index }` or `{ type: "clear", index, deckId }` |

Focus stops: `seat:<index>` (not on a locked seat) and `seat-clear:<deck id>`.
