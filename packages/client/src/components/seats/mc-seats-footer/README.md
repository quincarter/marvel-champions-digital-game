# mc-seats-footer

The two ways on from Take your seats: a quiet Deck check for the active seat's deck and the red Play N heroes. Stacked
(`wide`) at the foot of the ink detail panel; otherwise one row in the sticky ink bar. With no hero Deck check is disabled
and neither is a focus stop. Play carries `playBlocked` as its tooltip while off and still raises its press.

| Property | Type                                  | Notes                      |
| -------- | ------------------------------------- | -------------------------- |
| `model`  | `SeatsFooterModel` (`seats.types.ts`) |                            |
| `wide`   | `boolean` (attribute `wide`)          | stacked instead of one row |

| Event      | Detail                                               |
| ---------- | ---------------------------------------------------- |
| `mc-seats` | `{ type: "action", action: "play" \| "deck-check" }` |

Focus stops: `deck-check`, `play` (only with a hero seated).
