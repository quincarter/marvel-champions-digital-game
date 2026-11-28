# mc-legality-lines

The deck verdict in words from the engine own validateDeck (this decides nothing): the legal count or the problems, a campaign frozen reason, unsaved changes and the last status. Pure display, no press.

```html
<mc-legality-lines></mc-legality-lines>
```

| Property | Type          | Notes                           |
| -------- | ------------- | ------------------------------- |
| model    | LegalityModel | text, ok, frozen, dirty, status |
| on-dark  | boolean       | on the ink panel                |

The parent imports `mc-legality-lines/mc-legality-lines` once; shared `@mc/ui` elements are defined by the ui entry.
