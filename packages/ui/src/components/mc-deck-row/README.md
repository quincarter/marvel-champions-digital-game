# mc-deck-row

One deck on a list: the hero's picture, the deck's name, aspect stamps, where it came from, a legality verdict in words
(with a leading mark, never colour alone) and an action button. Built for Take your seats' "Pick a deck" sheet and
reusable by any deck list.

```html
<mc-deck-row .model="${row}" @mc-deck-pick="${(e) => seat(e.detail.deckId)}"></mc-deck-row>
```

| Property | Type                                      | Notes                         |
| -------- | ----------------------------------------- | ----------------------------- |
| `model`  | `McDeckRowModel` (`mc-deck-row.types.ts`) | every word arrives translated |

`McDeckRowModel`: `deckId`, `name`, `source`, `stamps` (`label`, `fill`, `ink`), `verdict`, `legal`, `picture`
(`PictureSource`), `seatLabel`, `disabled` (the reason, or null), and optional `status` (`ok`, `warning`, `blocked`,
`locked`), `mark` (the verdict's leading word or symbol) and `cardId` (the card the picture stands for).

| Event                                                   | Detail          | When                                                         |
| ------------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| `mc-deck-pick`                                          | `{ deckId }`    | the button was pressed on an enabled row                     |
| `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect` | see `watchCard` | the picture, when `cardId` is set                            |
| `mc-image-error`                                        | `{ src, key? }` | a picture failed to load (re-raised from the tile, composed) |

A disabled row keeps its button, dimmed, with the reason as its tooltip; a press does nothing.

Focus stop: `deck:<deck id>` on the button (Enter is `click()`, which presses it).

Pictures: the screen keeps each picture's `PictureSource` (key and URL) through its `PictureLeases`, brackets a redraw
with `begin()` / `end()` and `watch(element)`s the page, so a stale pack URL is read again from `mc-image-error`.
