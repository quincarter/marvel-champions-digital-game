# mc-save-data-confirm

The replace confirm: what the file holds and that it overwrites, then Cancel (stop `cancel`) and Replace (stop `replace`, the attack red).

| Property | Type                   | Meaning                                         |
| -------- | ---------------------- | ----------------------------------------------- |
| `input`  | `SaveDataConfirmInput` | Title, body, button words and the Cancel glyph. |

Events: `mc-save-data` `{ type: "menu" }` or `{ type: "replace" }`.

Needs `@mc/ui` defined.
