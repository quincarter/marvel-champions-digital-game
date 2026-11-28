# mc-builder-tabs

The strip of tabs on a tab rail: the narrow layout Pool, Deck and From your games, or the wide deck rail Your deck and From your games. LB / RB glyphs hang over the strip while a keyboard or pad is in use.

```html
<mc-builder-tabs></mc-builder-tabs>
```

| Property | Type             | Notes                         |
| -------- | ---------------- | ----------------------------- |
| model    | BuilderTabsModel | prefix, selected, tabs, glyph |

| Event           | Detail                                     |
| --------------- | ------------------------------------------ |
| mc-deck-builder | tab (tab: strip) or rail-tab (rail: strip) |

Focus stops: tab:<id> or rail:<id>

Uses: mc-tab-rail, mc-glyph-hint (@mc/ui)

The parent imports `mc-builder-tabs/mc-builder-tabs` once; shared `@mc/ui` elements are defined by the ui entry.
