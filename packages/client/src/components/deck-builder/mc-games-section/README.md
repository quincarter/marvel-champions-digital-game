# mc-games-section

A titled list of the cards From your games suggests: its title over a rule, then a row per card. A section with no card draws nothing.

```html
<mc-games-section></mc-games-section>
```

| Property | Type              | Notes           |
| -------- | ----------------- | --------------- |
| model    | GamesSectionModel | id, title, rows |

Uses: mc-games-row

The parent imports `mc-games-section/mc-games-section` once; shared `@mc/ui` elements are defined by the ui entry.
