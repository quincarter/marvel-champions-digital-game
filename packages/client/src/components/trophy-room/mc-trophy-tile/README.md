# mc-trophy-tile

One achievement as a card that is itself the control. It is an `McPress`: a tap, or the focus route's Enter (`click()`),
raises `mc-pressed` with the `action` the list gave it; the list's relay turns that into `mc-trophy-room`
`{ type: "achievement", id }`. EARNED is a solid ink card with paper words, LOCKED parchment with an outline, SOON dimmed
and dashed; every state is a word and a mark as well as a look (`mc-trophy-state`). A tracked achievement shows a progress
bar (`mc-progress-bar`) and its count.

| Property    | Type                                 | Notes                       |
| ----------- | ------------------------------------ | --------------------------- |
| `model`     | `TrophyTileModel \| null` (`.types`) | the `achievement` row       |
| `action`    | unknown                              | what a tap raises           |
| `data-stop` | string                               | `row:<id>`, set by the list |

Event: `mc-pressed` (`PressDetail`). Needs `@mc/ui` defined.
