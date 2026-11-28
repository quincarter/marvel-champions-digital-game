# mc-games-row

One card From your games suggests (issue 529, C2): its picture (a tap opens Inspect), name, a line of why, and a Cut or Add button. A suggestion only: pressing the button is the same as the deck list minus or the pool plus.

```html
<mc-games-row></mc-games-row>
```

| Property | Type          | Notes                                 |
| -------- | ------------- | ------------------------------------- |
| model    | GamesRowModel | cardId, name, detail, picture, action |
| section  | string        | the section id, for the picture key   |

| Event           | Detail                        |
| --------------- | ----------------------------- |
| mc-deck-builder | add / remove { cardId }, open |

Focus stops: games:<label>:<card id>

Uses: mc-card-art (@mc/ui), mc-button (@mc/ui)

The parent imports `mc-games-row/mc-games-row` once; shared `@mc/ui` elements are defined by the ui entry.
