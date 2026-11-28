# mc-builder-save-bar

Save, always under the deck so it stays reachable, and on a phone Deck tab Review beside it.

```html
<mc-builder-save-bar></mc-builder-save-bar>
```

| Property | Type         | Notes        |
| -------- | ------------ | ------------ |
| model    | SaveBarModel | save, review |

| Event           | Detail       |
| --------------- | ------------ |
| mc-deck-builder | save, review |

Focus stops: save, deck-review

Uses: mc-button (@mc/ui)

The parent imports `mc-builder-save-bar/mc-builder-save-bar` once; shared `@mc/ui` elements are defined by the ui entry.
