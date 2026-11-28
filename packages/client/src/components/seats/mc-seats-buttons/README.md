# mc-seats-buttons

The plain buttons of the filters row: Random, the hero art switch and Use preconstructed (`mc-button`, quiet). A button
that cannot act is dimmed with its reason as the tooltip, and a press still raises the event so the scene can say why.

```html
<mc-seats-buttons .buttons="${buttons}"></mc-seats-buttons>
```

| Property  | Type                 | Notes                                                          |
| --------- | -------------------- | -------------------------------------------------------------- |
| `buttons` | `SeatsButtonModel[]` | `action`, `label`, `disabled` (the reason or null), `selected` |

| Event      | Detail                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| `mc-seats` | `{ type: "action", action: "random" \| "game-art" \| "preconstructed" }` |

Focus stops: `hero-random`, `hero-art`, `preconstructed`.
