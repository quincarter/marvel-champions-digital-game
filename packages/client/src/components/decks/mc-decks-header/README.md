# mc-decks-header

The ink bar across the top of Decks & Collection: Back, the Bangers title, the pool size (not on a phone) and "Your stats".
Each button carries its pad glyph (`mc-glyph-hint`) while a keyboard or pad is in use. The scene drops the title under, or ends
it before, the dark mode tab with `titleDrop` / `titleMaxRight`.

| Property | Type                                  |
| -------- | ------------------------------------- |
| `model`  | `DecksHeaderModel` (`decks.types.ts`) |

| Event      | Detail                                                   |
| ---------- | -------------------------------------------------------- |
| `mc-decks` | `{ type: "action", action: "back" }` or `"player-stats"` |

Focus stops: `back`, `player-stats`.
