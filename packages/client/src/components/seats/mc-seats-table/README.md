# mc-seats-table

The four seats of Take your seats in one row, the Team-Up pairs under them and, on a narrow layout, the active seat's summary
strip. It composes `mc-seat-card` (wide) or `mc-seat-chip` (`compact`) per seat and `mc-seat-summary`, and imports their
define files; the seats and the summary raise `mc-seats` themselves, the pairs take no press.

The Team-Up pairs are CSS. Each pair is a row of the same four columns as the seats; its bracket spans the columns from one
partner to the other with a leg in the middle of each end column, the legs rise through the rows before it to the seats
above, and a pill (the pair's picture and words) sits centered on the line. At most three rows show.

```html
<mc-seats-table .seats="${seats}" .pairs="${pairs}" .summary="${summary}" compact></mc-seats-table>
```

| Property  | Type                            | Notes                                |
| --------- | ------------------------------- | ------------------------------------ |
| `seats`   | `readonly SeatModel[]`          | four seats                           |
| `pairs`   | `readonly SeatPairModel[]`      | `seats` are 1-based seat numbers     |
| `summary` | `SeatSummaryModel \| null`      | narrow layouts only; null draws none |
| `compact` | `boolean` (attribute `compact`) | chips instead of cards               |

Events and focus stops are the children's: `seat:<index>`, `seat-clear:<deck id>`, `seat-details-toggle`, `clear-seat`.
