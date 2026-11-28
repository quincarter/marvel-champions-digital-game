# mc-save-data-receive

The Receive step: the instructions, the code field (`mc-text-field`, stop `code`), Receive and Back. Enter in the field asks for the save as the button does; while the service answers only the title shows.

| Property | Type                   | Meaning                                           |
| -------- | ---------------------- | ------------------------------------------------- |
| `input`  | `SaveDataReceiveInput` | Title, help, the typed text and the button words. |

Events: `mc-save-data` `{ type: "receive" }` or `{ type: "menu" }`; `mc-input` and `mc-field-focus` from the field, passed through.

Needs `@mc/ui` defined.
