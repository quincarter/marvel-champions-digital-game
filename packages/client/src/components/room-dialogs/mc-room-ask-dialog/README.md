# mc-room-ask-dialog

"Ask for a change": a seated guest's note to the host. An `mc-dialog` holding a line of words, an `mc-text-field` and
Cancel / Send (`mc-popup-button`, with the key or pad glyph while one is in use).

```html
<mc-room-ask-dialog .model="${askModel}"></mc-room-ask-dialog>
```

| Property | Type           | Notes                                                          |
| -------- | -------------- | -------------------------------------------------------------- |
| `model`  | `RoomAskModel` | heading, body, placeholder, the draft, the two buttons, glyphs |

| Event            | Detail                                       |
| ---------------- | -------------------------------------------- |
| `mc-room-dialog` | `{ type: "press", key: "cancel" \| "send" }` |

Also bubbles the field's `mc-input` / `mc-field-focus` and the dialog's `mc-dialog-dismiss` (a tap on the scrim).
Stops: `field`, `cancel`, `send`. `field` is the text field (`restoreValue`, `focusInput`).
