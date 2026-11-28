# mc-seat-pairs

The Team-Up strip under the seat cards: for each pair a bracket drops from the centre of one partner's card, runs across
and up to the other's, with a pill on the line ("Team-Up: Colossus and Shadowcat", with the pair's picture where there is
art). Pure CSS grid: four columns that must line up with the seat cards (set `--mc-seats-gap` to the cards' gap). Later
pairs drop deeper (30px a row, up to six), so brackets never cross a pill. Display only: no press, no stop.

```html
<mc-seat-pairs .pairs="${pairs}"></mc-seat-pairs>
```

| Property | Type              | Notes                                                   |
| -------- | ----------------- | ------------------------------------------------------- |
| `pairs`  | `SeatPairModel[]` | `seats` are 1-based seat numbers (1 to 4), either order |

No events.
