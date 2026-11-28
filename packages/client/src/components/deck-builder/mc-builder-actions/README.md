# mc-builder-actions

Preconstructed, Clear and Delete in one row, and below it a campaign optional deck freeze. A button that does nothing now stays in place, dimmed, with its reason; Delete asks first.

```html
<mc-builder-actions></mc-builder-actions>
```

| Property | Type                | Notes                         |
| -------- | ------------------- | ----------------------------- |
| model    | BuilderActionsModel | precon, clear, delete, freeze |
| on-dark  | boolean             |                               |

| Event           | Detail                        |
| --------------- | ----------------------------- |
| mc-deck-builder | precon, clear, delete, freeze |

Focus stops: preconstructed, clear, delete, freeze-deck

Uses: mc-button (@mc/ui)

The parent imports `mc-builder-actions/mc-builder-actions` once; shared `@mc/ui` elements are defined by the ui entry.
