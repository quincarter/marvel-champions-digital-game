# mc-lobby-header

The room lobby's top bar (`mc-top-bar`: Leave with its glyph, the title, the player's role) and the ink code strip under it:
the room code, Copy link, the host's Live now toggle when the strip has room, and the connection line.

| Property  | Type               | Notes                        |
| --------- | ------------------ | ---------------------------- |
| `model`   | `LobbyHeaderModel` | `hidden` hides it (keyboard) |
| `compact` | `boolean` (attr)   | a phone's smaller bar        |

| Event           | Detail                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| `mc-room-lobby` | `{ type: "leave" }`, `{ type: "copy-link" }`, `{ type: "setting", key }` |

Stops: `back`, `copy`, `listed`.
