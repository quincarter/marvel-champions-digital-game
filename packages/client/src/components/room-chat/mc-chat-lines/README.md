# mc-chat-lines

The room chat's lines in one natively scrolling column (the lobby's Chat panel and the in-game chat dialog). Mine are in a
heavier frame. A change of `model.toEnd` scrolls the column to the newest line.

```html
<mc-chat-lines .model="${{ lines, empty: "No messages yet", toEnd }}" list-key="list:chat"></mc-chat-lines>
```

| Property   | Type             | Notes                                     |
| ---------- | ---------------- | ----------------------------------------- |
| `model`    | `ChatLinesModel` | lines, the empty words, the `toEnd` count |
| `list-key` | `string`         | the scroller's `data-key` (`list:chat`)   |

Raises no events. `scroller` is the column, for the pad's stick.
