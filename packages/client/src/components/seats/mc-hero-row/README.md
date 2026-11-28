# mc-hero-row

One row of hero tiles under a header strip: the `head` slot (title, See all) with real ‹ › buttons at the strip's end, and
the tiles scrolling sideways. The buttons sit beside the row, never over it. `wrap` lays the tiles out as a grid with no
buttons; `open=false` shows only the strip (a folded shelf).

It owns the picture lease: a tile loads while it is near the row's view (sideways) and the row is near `scrollRoot`'s
view (down), and gives its URL back when it is not. With no `IntersectionObserver` every tile loads.

```html
<mc-hero-row .tiles="${tiles}" .scrollRoot="${scroller}" previous-label="Earlier heroes" next-label="More heroes">
  <div slot="head">...</div>
</mc-hero-row>
```

| Property                       | Type                     | Notes                                                 |
| ------------------------------ | ------------------------ | ----------------------------------------------------- |
| `tiles`                        | `HeroTileModel[]`        |                                                       |
| `open`                         | `boolean` (default true) |                                                       |
| `wrap`                         | `boolean`                | grid, no buttons                                      |
| `scrollRoot`                   | `Element` or null        | the page's vertical scroller                          |
| `previous-label`, `next-label` | `string`                 | the buttons' names (with `shelf-label` appended)      |
| `hint`                         | `PagingGlyphs` or null   | pad glyphs beside the buttons, which then always show |

Methods: `page(direction)` (key of the first tile at the row's start, or null), `canPage(direction)`, `rowElement`.
Events: none of its own; tiles' `mc-seats` bubble through. Styling hook: `--mc-hero-tile-gap`.
