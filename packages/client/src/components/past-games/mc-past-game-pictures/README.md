# mc-past-game-pictures

A game's villain and heroes as card pictures, villain first. A thin frame, the hero's aspect chips along its foot
(`mc-past-game-aspects`), and the name printed on a picture with no art. A picture with a card is a card picture: a mouse
over it raises `mc-card-hover`, a hold raises `mc-card-inspect` (`watchCard`); the scene's `CardEvents` hears both.

| Property   | Attribute | Type                           |
| ---------- | --------- | ------------------------------ |
| `pictures` | -         | `PastGamePicture[]` (`.types`) |
| `size`     | `size`    | `row` (default) or `detail`    |

CSS: `--pic-h` is a row picture's height (84px beside the words, 64px stacked: the row sets it). The `detail` size fills
the width it is given. Stops: none. The pictures take no press; their row or panel does.
