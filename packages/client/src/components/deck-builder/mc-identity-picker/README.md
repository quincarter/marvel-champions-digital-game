# mc-identity-picker

New deck first step: a hero search over a grid of hero tiles in one native scroller, so a swipe over it never picks the hero it lifts over. The search holds the text the screen accepted.

```html
<mc-identity-picker></mc-identity-picker>
```

| Property | Type                | Notes                                |
| -------- | ------------------- | ------------------------------------ |
| model    | IdentityPickerModel | label, search, tiles, empty, tileMin |

| Event           | Detail                                   |
| --------------- | ---------------------------------------- |
| mc-deck-builder | identity-search, pick-hero, hero-inspect |

Focus stops: identity-search, identity:<id>

Uses: mc-identity-tile, mc-search-field (@mc/ui)

The parent imports `mc-identity-picker/mc-identity-picker` once; shared `@mc/ui` elements are defined by the ui entry.
