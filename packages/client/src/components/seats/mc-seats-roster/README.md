# mc-seats-roster

Take your seats' hero roster, in the one box that scrolls down: the Recommended strip (`mc-rec-strip`) first when there is
someone to recommend, then a shelf per pack (`mc-hero-shelf`), each a sideways `mc-hero-row` of `mc-hero-tile`s. In `grid`
mode one pack's tiles wrap under a "◂ All packs" button; with `emptyText` the words show with a Clear button.

```html
<mc-seats-roster .model="${roster}"></mc-seats-roster>
```

| Property | Type                                  | Notes                   |
| -------- | ------------------------------------- | ----------------------- |
| `model`  | `SeatsRosterModel` (`seats.types.ts`) | words arrive translated |

| Event      | Detail                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `mc-seats` | its own `{ type: "action", action: "drill-back" or "hero-clear" }`, plus the parts' `hero`, `shelf` and `rec-toggle` events |

Focus stops: `rec-toggle`, `hero-shelf:<pack id>`, `hero:<card id>`, `hero-rec:<card id>`, `drill-back`, `hero-clear`.
The scene finds them with `focusStopsOf` (open shadow roots); a stop in a row scrolls into view by its scroll container.

Methods: `pageShelf(shelfId, direction)` (LT / RT: pages that shelf's row, returns the first tile's key or null),
`readScroll()` / `restoreScroll(state)` (the page remembers the position across Deck check and back).

Contract additions (`seats.types.ts`): `SeatsRosterModel.pagingGlyphs?: PagingGlyphs | null` and `PagingGlyphs`
(`previous`, `next` glyph specs, `height`, `still`): the glyphs drawn for `pagingHintShelf`.

Layout is CSS only: tiles size from `--mc-hero-tile-width` (`clamp(140px, 22cqw, 220px)` of the scroller's width, set on
the roster's stack) and `--mc-hero-tile-gap`.
