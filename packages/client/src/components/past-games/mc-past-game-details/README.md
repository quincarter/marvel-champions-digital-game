# mc-past-game-details

One game's details: the villain and the heroes as larger pictures, the words (result, why, title, when, the campaign and
every seat's hero, stats, deck and most played cards) in a scrolling region of their own, and the four actions
(`mc-past-game-actions`). Beside the list it is a panel; with `popup` (a phone) it stands over the screen on a scrim that
takes every press and does nothing, with a close button (stop `close`). The words keep their scroll while the same game shows.

| Property | Attribute | Type                                      |
| -------- | --------- | ----------------------------------------- |
| `model`  | -         | `PastGameDetailsModel \| null` (`.types`) |
| `popup`  | `popup`   | boolean                                   |

`scroller` is the words' scrolling box (the scene's stick and Page keys move it). Events: `mc-past-games` `{ type: "close" }`;
the actions' events pass through. Stops: `close` (popup), `action:*`. Needs `@mc/ui` defined.
