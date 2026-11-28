# mc-start-from

New deck second step for a hero with a published precon: the hero picture, then an empty deck or the player's own copy of a precon, in the aspect colors.

```html
<mc-start-from></mc-start-from>
```

| Property | Type           | Notes                              |
| -------- | -------------- | ---------------------------------- |
| model    | StartFromModel | label, picture, options, backLabel |

| Event           | Detail     |
| --------------- | ---------- |
| mc-deck-builder | start { id | null }, start-back |

Focus stops: start:empty, start:<precon id>, start:back

Uses: mc-card-art, mc-button (@mc/ui)

The parent imports `mc-start-from/mc-start-from` once; shared `@mc/ui` elements are defined by the ui entry.
