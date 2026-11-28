# mc-save-data-status

The line under the step: what just happened or that a file is in flight. An error carries a mark as well as its words; Export (stop `status-export`) appears when the service is unavailable.

| Property | Type                  | Meaning                                          |
| -------- | --------------------- | ------------------------------------------------ |
| `input`  | `SaveDataStatusInput` | The text, its tone and the optional Export word. |

Events: `mc-save-data` `{ type: "status-export" }`.

Needs `@mc/ui` defined.
