# mc-type-filters

The pool type chips: All plus every card type the pool holds, one chosen. They wrap as the column narrows.

```html
<mc-type-filters></mc-type-filters>
```

| Property | Type             | Notes        |
| -------- | ---------------- | ------------ |
| model    | TypeFiltersModel | label, chips |

| Event           | Detail             |
| --------------- | ------------------ |
| mc-deck-builder | type-filter { id } |

Focus stops: type:<id>

Uses: mc-button (@mc/ui)

The parent imports `mc-type-filters/mc-type-filters` once; shared `@mc/ui` elements are defined by the ui entry.
