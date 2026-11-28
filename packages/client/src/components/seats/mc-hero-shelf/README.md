# mc-hero-shelf

One pack's shelf: header (cover, title with the rule and count, a fold chevron, "See all") over a sideways `mc-hero-row`.
The header is one stop, `hero-shelf:<pack id>`. "See all" is a button of its own (no stop, as before).

```html
<mc-hero-shelf .shelf="${shelf}" .scrollRoot="${scroller}" previous-label="..." next-label="..."></mc-hero-shelf>
```

| Property                       | Type                   | Notes                         |
| ------------------------------ | ---------------------- | ----------------------------- |
| `shelf`                        | `HeroShelfModel`       | `open` undefined: never folds |
| `previous-label`, `next-label` | `string`               |                               |
| `hint`                         | `PagingGlyphs` or null |                               |
| `scrollRoot`                   | `Element` or null      |                               |

| Event      | Detail                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `mc-seats` | `{ type: "shelf", id, change: "fold" }` (header), `change: "all"` (See all, or the header of a shelf that never folds); tiles' `hero` events |
