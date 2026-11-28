# mc-past-games-file-button

"Open a replay file" at the top bar's right end (put it in `mc-top-bar`'s `end` slot): an `onInk` button with an open-folder
mark at its left, so it reads as "open a file" at a glance. It is dimmed while something is running. Stop: `open-file`.
The `phone` attribute makes it narrower.

| Property | Attribute | Type                            |
| -------- | --------- | ------------------------------- |
| `model`  | -         | `PastGamesFileModel` (`.types`) |
| `phone`  | `phone`   | boolean                         |

Event: `mc-past-games` `{ type: "open-file" }`. Needs `@mc/ui` defined (`mc-button`).
