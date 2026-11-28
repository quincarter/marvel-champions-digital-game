# mc-deck-line

One line of Your deck: the card name, its copies and its own minus. A hold or right-click opens Inspect (watchCard); a plain press does too where the line is a campaign grant. A mouse over the line opens the card popover.

```html
<mc-deck-line></mc-deck-line>
```

| Property | Type          | Notes                                                |
| -------- | ------------- | ---------------------------------------------------- |
| model    | DeckLineModel | cardId, name, quantity, note, minus, openOnTap, face |

| Event           | Detail       |
| --------------- | ------------ |
| mc-deck-builder | remove, open |

Uses: mc-button (@mc/ui)

The parent imports `mc-deck-line/mc-deck-line` once; shared `@mc/ui` elements are defined by the ui entry.
