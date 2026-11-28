# mc-lobby-chat

The online room lobby's Chat panel: `mc-chat-lines` (the native `list:chat` scroller) over `mc-chat-compose` (a real text
field and Send). Built to `LobbyChatModel`. The panel is the same element in the Chat tab, the floating chat and the ultrawide
column.

```html
<mc-lobby-chat .model="${chat}"></mc-lobby-chat>
```

| Property   | Type                     | Notes                                                                 |
| ---------- | ------------------------ | --------------------------------------------------------------------- |
| `model`    | `LobbyChatModel \| null` |                                                                       |
| `floating` | `boolean` (reflected)    | set from `model.floating`: opaque, a heavier border and a drop shadow |

| Getter     | Notes                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| `compose`  | the `mc-chat-compose` (its `field` is the text field, for `restoreValue`) |
| `scroller` | the lines' column (`list:chat`)                                           |

States: `enabled: false` shows only `off`; `popped` shows only `poppedText` and Bring back; otherwise lines and compose.
Pop out appears only when the model gives a `popout` button (the scene hands one over on the floating panel and the ultrawide
column only); Close only when `close` is given (the floating panel). `popBlocked` is a line under the heading.

| Event           | Detail          | Notes                                                                             |
| --------------- | --------------- | --------------------------------------------------------------------------------- |
| `mc-room-lobby` | `LobbyEvent`    | `{ type: "chat", what }` from Pop out, Close, Bring back (through `FeatureRelay`) |
| `mc-room-chat`  | `RoomChatEvent` | Send or Enter, from `mc-chat-compose`                                             |
| `mc-input`      | text field's    | the draft; the scene keeps it and hands it back as `compose.value`                |

Stops: `chat-field`, `chat-send`, `chat-popout`, `chat-close`, `chat-bring-back` (from the model), and `list:chat`.
