# mc-deck-charts

The cost curve and the draw odds. On the wide left rail they share its last room behind two tabs; stacked in the narrow Deck tab both show under their own labels.

```html
<mc-deck-charts></mc-deck-charts>
```

| Property | Type            | Notes                   |
| -------- | --------------- | ----------------------- |
| model    | DeckChartsModel | labels, bars, odds      |
| mode     | tabs or stacked |                         |
| tab      | curve or odds   | the chart the tabs show |

| Event           | Detail                  |
| --------------- | ----------------------- |
| mc-deck-builder | chart-tab { tab }, odds |

Focus stops: chart:curve, chart:odds

Uses: mc-bar-chart (@mc/ui), mc-odds-panel

The parent imports `mc-deck-charts/mc-deck-charts` once; shared `@mc/ui` elements are defined by the ui entry.
