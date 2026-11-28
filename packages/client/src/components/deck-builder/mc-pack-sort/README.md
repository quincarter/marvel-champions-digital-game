# mc-pack-sort

The pool Pack stepper, Wave button and the Sort and Then buttons. Pressing the pack name or the wave button opens a picker; the arrows step one pack at a time.

```html
<mc-pack-sort></mc-pack-sort>
```

| Property | Type          | Notes                          |
| -------- | ------------- | ------------------------------ |
| model    | PackSortModel | label, pack, cycle, sort, then |

| Event           | Detail                                       |
| --------------- | -------------------------------------------- |
| mc-deck-builder | pack-step, pack-pick, cycle-pick, sort, then |

Focus stops: pack:prev, pack:name, pack:next, pack:cycle, pack:sort, pack:then

Uses: mc-stepper, mc-button (@mc/ui)

The parent imports `mc-pack-sort/mc-pack-sort` once; shared `@mc/ui` elements are defined by the ui entry.
