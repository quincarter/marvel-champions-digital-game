# mc-rec-strip

The Recommended shelf that leads the roster: a band with a red rule down its edge, a header ("Recommended for seat 2",
"3 heroes · Hide") over a row of `hero-rec:` tiles whose captions say why. The header is one stop, `rec-toggle`, and raises
the plain `rec-toggle` action (not a shelf event) so the scene can keep its own remembered fold.

```html
<mc-rec-strip .shelf="${recommended}" .scrollRoot="${scroller}" previous-label="..." next-label="..."></mc-rec-strip>
```

| Property                       | Type                   | Notes                                        |
| ------------------------------ | ---------------------- | -------------------------------------------- |
| `shelf`                        | `HeroShelfModel`       | id `recommended`; `open` false: header alone |
| `previous-label`, `next-label` | `string`               |                                              |
| `hint`                         | `PagingGlyphs` or null |                                              |
| `scrollRoot`                   | `Element` or null      |                                              |

| Event      | Detail                                                           |
| ---------- | ---------------------------------------------------------------- |
| `mc-seats` | `{ type: "action", action: "rec-toggle" }`; tiles' `hero` events |
