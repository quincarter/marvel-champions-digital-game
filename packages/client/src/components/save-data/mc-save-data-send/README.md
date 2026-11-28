# mc-save-data-send

The Send step: the title while uploading, then the instructions, the code, the countdown and a QR code of the receive link. Copy code turns into New code when the code expires; Back returns to the rows.

| Property | Type                | Meaning                                       |
| -------- | ------------------- | --------------------------------------------- |
| `input`  | `SaveDataSendInput` | Uploading, or the code and what goes with it. |

Events: `mc-save-data` `{ type: "copy" }`, `{ type: "new-code" }` or `{ type: "menu" }`.

Needs `@mc/ui` defined.
