# mc-hero-tile

A hero on a shelf: picture (aspect stamps along the foot, tag top right, Team-Up plate top left) over a caption of the title
and one line (source and identity, a recommendation's reason, or a short warning that replaces it). The chosen tile has the
heavy red frame and says SEAT n in its tag; a tile that cannot be seated is dimmed and says why in its tag, so state is never
colour alone. The whole tile is one button and one stop, the model's `key` (`hero:<card id>` or `hero-rec:<card id>`).

```html
<mc-hero-tile .model="${tile}" .near="${true}"></mc-hero-tile>
```

| Property | Type                               | Notes                                                                   |
| -------- | ---------------------------------- | ----------------------------------------------------------------------- |
| `model`  | `HeroTileModel` (`seats.types.ts`) | words arrive translated                                                 |
| `near`   | `boolean` (default `true`)         | the picture lease: false drops the URL so the browser lets the image go |

| Event      | Detail                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `mc-seats` | `{ type: "hero", key, via: "press" }`, or `via: "inspect"` from a hold, right-click or `inspect()` |

The picture is a card picture (`watchCard`): a mouse over it raises `mc-card-hover` / `mc-card-hover-end` with the model's
`cardId`. Its own `mc-card-inspect` is stopped at the tile, because the tile's inspect (`via: "inspect"`) is the one the
roster wants; the pad's Inspect key calls `inspect()`. `inspect: false` in the model raises no inspect.

Methods: `inspect()`, `artElement` (the picture, for rects).
