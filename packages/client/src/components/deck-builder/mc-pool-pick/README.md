# mc-pool-pick

The deck builder pack and wave picker (issue 977) as a dialog: every pack under its wave, or every wave, is a row that toggles; All clears the choice. Each press applies at once.

```html
<mc-pool-pick></mc-pool-pick>
```

| Property | Type          | Notes                                                 |
| -------- | ------------- | ----------------------------------------------------- |
| model    | PoolPickModel | title, subtitle, allLabel, allChosen, rows, doneLabel |

| Event             | Detail                             |
| ----------------- | ---------------------------------- |
| mc-deck-builder   | pick-all, pick-toggle, sheet-close |
| mc-dialog-dismiss | a tap on the scrim                 |

Focus stops: pick:all, pick:<id>, done

Uses: mc-dialog, mc-button (@mc/ui)

The parent imports `mc-pool-pick/mc-pool-pick` once; shared `@mc/ui` elements are defined by the ui entry.
