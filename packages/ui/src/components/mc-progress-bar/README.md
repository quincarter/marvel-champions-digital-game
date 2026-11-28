# mc-progress-bar

A thin outlined track with a Hero Red fill: the rank toward the next rank, an achievement's count. The track takes the
colour of the words around it, so it reads on ink and on paper. It draws no words; `label` is what a screen reader hears.

```html
<mc-progress-bar fraction="0.4" label="4 / 10"></mc-progress-bar>
```

| Property   | Attribute  | Type   | Meaning                                  |
| ---------- | ---------- | ------ | ---------------------------------------- |
| `fraction` | `fraction` | number | How far along, 0 to 1 (clamped).         |
| `label`    | `label`    | string | The accessible description (translated). |

CSS: `--mc-progress-height` (10px). No events, no slots.
