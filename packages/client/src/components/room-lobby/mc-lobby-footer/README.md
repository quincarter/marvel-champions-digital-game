# mc-lobby-footer

The ink strip across the bottom of the lobby: a line of words (`data-key="footer-words"`) and, for the host, the Start button,
a Stay / Close room pair, or Back to title. A container query puts the words beside the button from 600px wide.

| Property | Type               | Notes                           |
| -------- | ------------------ | ------------------------------- |
| `model`  | `LobbyFooterModel` | `hidden` hides it (keyboard up) |

| Event           | Detail                                                |
| --------------- | ----------------------------------------------------- |
| `mc-room-lobby` | `{ type: "footer", action }` or `{ type: "blocked" }` |

Stops: `start`, `stay`, `close`, `back-title`.
