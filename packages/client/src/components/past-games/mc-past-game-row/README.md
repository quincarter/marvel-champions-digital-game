# mc-past-game-row

One finished game in the list: pictures (`mc-past-game-pictures`) and words (`mc-past-game-summary`) in a framed card that
is itself the control. It is an `McPress`: a tap, or the focus route's Enter (`click()`), raises `mc-pressed` with the
`action` the list gave it; the list's relay turns that into `mc-past-games` `{ type: "select", id }`. The selected game wears
the heavy red frame, and `aria-pressed`. Wide, the pictures sit beside the words; under 520px the row's own width, they make a
strip above them (a container query on the row). `content-visibility: auto` keeps a long history light.

| Property    | Type                                  | Notes                    |
| ----------- | ------------------------------------- | ------------------------ |
| `model`     | `PastGameRowModel \| null` (`.types`) |                          |
| `selected`  | boolean (attribute)                   | the details show it      |
| `action`    | unknown                               | what a tap raises        |
| `data-stop` | string                                | `game:<id>`, set by list |

Event: `mc-pressed` (`PressDetail`).
