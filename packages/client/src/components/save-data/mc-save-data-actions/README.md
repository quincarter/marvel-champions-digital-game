# mc-save-data-actions

The six ways to move or share your data, each a title (sync carries a BETA stamp), a line of detail and a button, the stop `row:<id>`. Two by two where wide, one column on a phone.

| Property | Type                   | Meaning                                   |
| -------- | ---------------------- | ----------------------------------------- |
| `input`  | `SaveDataActionsInput` | The rows and whether a file is in flight. |

Events: `mc-save-data` `{ type: "action", id }`.

Needs `@mc/ui` defined.
