# mc-extras-player

The Music tab's player: an ink block (the note, the status in caution yellow, the song in Bangers, what is playing it and a progress bar with its clock) over the music popover's `mc-player-controls` (Shuffle, Next, Pause) and, on a desktop form factor, an `mc-volume-slider`; both are the generic controls the music popover uses. The bar follows the song on its own quarter-second timer reading `progress`, so the page is never redrawn for it.

## Properties

| Name       | Type                           | Meaning                                              |
| ---------- | ------------------------------ | ---------------------------------------------------- |
| `model`    | `ExtrasPlayerModel`            | Status, song, detail, the three buttons, the slider. |
| `progress` | `() => PlayerProgress` or null | Reads how far into the song it is.                   |

## Events

`mc-extras`: `player` (`shuffle`, `next`, `pause`), `volume` (`share`, `commit`) and `volume-step`. Stops: `player:shuffle`, `player:next`, `player:pause` (the keys the model gives its buttons) and the slider's `volume-down`, `volume-up`.
