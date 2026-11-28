# mc-past-game-summary

How a game went, in words: the result with its reason beside it, the title (two lines at most on a row), when and how long,
and which heroes fell and which stood. `size="detail"` makes the result large over its reason and adds the campaign line.
The result is always a word (WON, LOST, CONCEDED); the green or red only agrees with it.

| Property | Attribute | Type                                      |
| -------- | --------- | ----------------------------------------- |
| `model`  | -         | `PastGameSummaryModel \| null` (`.types`) |
| `size`   | `size`    | `row` (default) or `detail`               |

No events, no stops, no slots.
