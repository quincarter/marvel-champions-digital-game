# mc-show-toggles

The Hero and Basic switches (issue 977): on shows that kind of card in the pool. Chips are filled with a tick while on. Inline, the word, the chips and the card count share one row.

```html
<mc-show-toggles></mc-show-toggles>
```

| Property | Type             | Notes                  |
| -------- | ---------------- | ---------------------- |
| model    | ShowTogglesModel | label, toggles, count  |
| inline   | boolean          | one row with the count |

| Event           | Detail       |
| --------------- | ------------ |
| mc-deck-builder | show { key } |

Focus stops: type:show-hero, type:show-basic

Uses: mc-button (@mc/ui)

The parent imports `mc-show-toggles/mc-show-toggles` once; shared `@mc/ui` elements are defined by the ui entry.
