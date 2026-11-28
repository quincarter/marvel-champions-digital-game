# mc-room-lobby-page

The online room lobby as one custom element: it composes the sections and holds no state. The scene (`scenes/room-lobby.ts`)
sets `model` (`LobbyPageModel`) and listens for the one `mc-room-lobby` event.

| Mode     | Arrangement                                                                  |
| -------- | ---------------------------------------------------------------------------- |
| `tabs`   | the tab strip and the one chosen panel (a phone)                             |
| `stack`  | seats across the top, the tab strip, then settings or chat (portrait tablet) |
| `wide`   | seats left, settings over chat right (landscape tablet)                      |
| `float`  | seats left, settings right, chat a floating panel behind a Chat pill         |
| `triple` | seats, settings and chat side by side (ultrawide)                            |

`compact` (the keyboard is up over the Chat tab) hides the header and footer. `covered` shortens the page by the keyboard's
height. `scroller("seats" | "settings" | "chat")` returns a panel's `list:<key>` scroll region.

Sections: `mc-lobby-header`, `mc-lobby-tabs`, `mc-lobby-frame`, `mc-lobby-seats` / `mc-lobby-epic` / `mc-lobby-competitive`,
`mc-lobby-settings`, `mc-lobby-chat`, `mc-lobby-chat-pill`, `mc-lobby-footer`.
