# mc-identity-row

The chosen identity above the builder: one card-like row with the hero picture, name and a Read card cue. A tap opens Inspect on the hero side.

```html
<mc-identity-row></mc-identity-row>
```

| Property | Type             | Notes                             |
| -------- | ---------------- | --------------------------------- |
| model    | IdentityRowModel | cardId, label, name, cue, picture |
| layout   | string           | phone: spans the column           |

| Event      | Detail               |
| ---------- | -------------------- |
| mc-pressed | action identity-card |

Focus stops: identity-card

Uses: mc-card-art (@mc/ui)

The parent imports `mc-identity-row/mc-identity-row` once; shared `@mc/ui` elements are defined by the ui entry.
