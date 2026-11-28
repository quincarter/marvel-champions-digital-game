# mc-seats-notice

The same-name clash strip under the seats: a caution-filled, ink-outlined button whose words say how many cards cannot be
played, and which opens the sheet that answers it.

```html
<mc-seats-notice text="2 cards can't be played with these heroes ▸"></mc-seats-notice>
```

| Property | Type     | Notes                           |
| -------- | -------- | ------------------------------- |
| `text`   | `string` | translated; empty draws nothing |

| Event      | Detail                                          |
| ---------- | ----------------------------------------------- |
| `mc-seats` | `{ type: "action", action: "conflict-notice" }` |

Focus stop: `conflict-notice`.
