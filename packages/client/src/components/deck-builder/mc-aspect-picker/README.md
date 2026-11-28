# mc-aspect-picker

One chip per choosable aspect in the aspect own card-frame colors (a tick says chosen, never colour alone) with an i segment that opens the aspect tip. A mouse resting on the i raises aspect-hover; the scene opens the tip after a pause.

```html
<mc-aspect-picker></mc-aspect-picker>
```

| Property | Type              | Notes        |
| -------- | ----------------- | ------------ |
| model    | AspectPickerModel | label, chips |

| Event           | Detail                            |
| --------------- | --------------------------------- |
| mc-deck-builder | aspect, aspect-info, aspect-hover |

Focus stops: aspect:<aspect>

Uses: mc-tip-chip (@mc/ui)

The parent imports `mc-aspect-picker/mc-aspect-picker` once; shared `@mc/ui` elements are defined by the ui entry.
