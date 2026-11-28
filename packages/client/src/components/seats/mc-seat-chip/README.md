# mc-seat-chip

One seat on Take your seats' narrow layouts (phone, tablet portrait): the red label, a Bangers name or the empty word, and a
short meta line where there is room. The frame says the seat's state without colour, as `mc-seat-card`'s does: solid red
(active, filled), dashed red (active, empty), thin ink (filled), dashed ink (empty), dashed and dimmed (locked). There is no
clear ✕ at this width: clearing is `mc-seat-summary`'s Clear seat.

```html
<mc-seat-chip .model="${seat}"></mc-seat-chip>
```

| Property | Type                           | Notes                                                                |
| -------- | ------------------------------ | -------------------------------------------------------------------- |
| `model`  | `SeatModel` (`seats.types.ts`) | words arrive translated; `model.chip` holds the chip's shorter words |

| Event      | Detail                    |
| ---------- | ------------------------- |
| `mc-seats` | `{ type: "seat", index }` |

Focus stop: `seat:<index>` (not on a locked seat).
