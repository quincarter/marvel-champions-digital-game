# mc-deck-name

The deck name over a real input, kept as it is typed (a short pause) so Save never holds an older one. The field holds the text the screen accepted; an edit the screen refuses is put back (restoreValue).

```html
<mc-deck-name></mc-deck-name>
```

| Property | Type          | Notes                                |
| -------- | ------------- | ------------------------------------ |
| model    | DeckNameModel | label, text, placeholder, clearLabel |

| Event           | Detail        |
| --------------- | ------------- |
| mc-deck-builder | name { text } |

Focus stops: name

Uses: mc-search-field (@mc/ui)

The parent imports `mc-deck-name/mc-deck-name` once; shared `@mc/ui` elements are defined by the ui entry.
