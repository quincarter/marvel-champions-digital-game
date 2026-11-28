# mc-room-chat-dialog

The in-game room chat over the board: an `mc-dialog` holding `mc-chat-lines`, `mc-chat-compose` (a real text field and Send)
and Close (`mc-popup-button`). The field lives as long as the dialog, so an arriving line or a resize keeps its caret.

```html
<mc-room-chat-dialog .model="${chatModel}"></mc-room-chat-dialog>
```

| Property | Type                  | Notes                                                      |
| -------- | --------------------- | ---------------------------------------------------------- |
| `model`  | `RoomChatDialogModel` | heading, lines, the draft, placeholder, Send's word, Close |

| Event            | Detail                                       |
| ---------------- | -------------------------------------------- |
| `mc-room-dialog` | `{ type: "press", key: "close" }`            |
| `mc-room-chat`   | `{ type: "send", via: "button" \| "enter" }` |

Stops: `field`, `send`, `close`. `compose` and `scroller` are for the scene.
