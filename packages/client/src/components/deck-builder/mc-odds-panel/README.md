# mc-odds-panel

The draw odds (issue 531): which group of cards (a stepper that wraps), how many are drawn (a stepper whose middle goes back to the opening hand), and the chance of drawing 0, 1, 2 and 3+ of the group, and at least one.

```html
<mc-odds-panel></mc-odds-panel>
```

| Property | Type      | Notes                                                 |
| -------- | --------- | ----------------------------------------------------- |
| model    | OddsModel | empty, group, draws, canFewer, canMore, line, atLeast |

| Event           | Detail        |
| --------------- | ------------- |
| mc-deck-builder | odds { part } |

Focus stops: odds:prev, odds:group, odds:next, odds:fewer, odds:draws, odds:more

Uses: mc-stepper (@mc/ui)

The parent imports `mc-odds-panel/mc-odds-panel` once; shared `@mc/ui` elements are defined by the ui entry.
