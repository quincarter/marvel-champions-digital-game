# mc-decks-games

The stats pane's From your games view (#529): the headline and insight about this hero's games, then lists of cards (Cut, Try,
Keep, and what to try or cut against a villain), each with its scan and what the games say, and the one button that opens the
builder on the same tab. While the saves are being read it says so and nothing else.

| Property | Type                                 |
| -------- | ------------------------------------ |
| `model`  | `DecksGamesModel` (`decks.types.ts`) |

| Event                                                   | Detail                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `mc-decks`                                              | `{ type: "action", action: "games-against" \| "games-open" }` |
| `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect` | from a card's scan (see `watchCard`)                          |

Focus stops: `games-against` (a stepper, drawn dimmed with one villain), `games-open`.
