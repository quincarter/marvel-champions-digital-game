# mc-trophy-sheet

One achievement spelled out in full over the whole screen: the name, its state, reward and count in one line, what it
takes, and a Close button (stop `close`, key hint B). A scrim takes every press outside the box; a tap on it closes the sheet
(never the lift that ends a swipe) and presses nothing beneath. The scene gives the Close button the route while the sheet is up.

| Property | Type                                  |
| -------- | ------------------------------------- |
| `model`  | `TrophySheetModel \| null` (`.types`) |

Event: `mc-trophy-room` `{ type: "close" }`. Needs `@mc/ui` defined (`mc-hint-button`).
