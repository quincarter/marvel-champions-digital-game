# mc-games-panel

From your games (issue 529, C2): the headline and one insight, the cards to cut and to try, the Against block, what won and lost against the villain, and the staples to keep. Pure composition: its parts raise the events.

```html
<mc-games-panel></mc-games-panel>
```

| Property | Type            | Notes                                                           |
| -------- | --------------- | --------------------------------------------------------------- |
| model    | GamesPanelModel | reading, headline, insight, first, against, then, nothing, note |
| on-dark  | boolean         | the headline is caution yellow on the ink panel                 |

Uses: mc-games-section, mc-games-against

The parent imports `mc-games-panel/mc-games-panel` once; shared `@mc/ui` elements are defined by the ui entry.
