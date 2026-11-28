# mc-lobby-chat-pill

The closed floating chat: a Chat button at the corner with the unread count beside it. While the chat is in its own window,
a small card with the notice and Bring back in its place. Built to `LobbyChatPillModel`.

```html
<mc-lobby-chat-pill .model="${pill}"></mc-lobby-chat-pill>
```

| Property | Type                         | Notes                                      |
| -------- | ---------------------------- | ------------------------------------------ |
| `model`  | `LobbyChatPillModel \| null` | `unread` 0: no badge; over 9 it reads "9+" |

| Event           | Detail       | Notes                                                                |
| --------------- | ------------ | -------------------------------------------------------------------- |
| `mc-room-lobby` | `LobbyEvent` | `{ type: "chat", what: "open" \| "bring-back" }`, via `FeatureRelay` |

Stops: the model's `open.stop` (`chat-pill`) and `bringBack.stop` (`chat-bring-back`). The count is written, never colour alone.
