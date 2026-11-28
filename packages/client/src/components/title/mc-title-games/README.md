# mc-title-games

The In-progress games panel of a wide Title. Each game is a row (name, detail, platform mark) with Resume, Watch and Remove;
asking to remove replaces the list with the question.

| Property | Meaning                                                                           |
| -------- | --------------------------------------------------------------------------------- |
| `input`  | `TitleGamesInput`: heading, tag, hint glyph, rows, the question, whether enabled. |

Focus stops: `game:<id>`, `game-watch:<id>`, `game-remove:<id>`, `remove-keep`, `remove-confirm`. The list scrolls natively;
a tap on the row (not a button) raises `mc-pressed` with `game:<id>`. Events: `mc-press` from buttons. Slots: none.
