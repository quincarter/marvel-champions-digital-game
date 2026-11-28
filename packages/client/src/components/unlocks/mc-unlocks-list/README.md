# mc-unlocks-list

The scrolling list of every wave and its heroes and campaigns: a section title, a wave line with its status, or an `mc-switch-row` per row. A campaign or hero switch is the stop `row:<id>`.

| Property | Type               | Meaning                   |
| -------- | ------------------ | ------------------------- |
| `rows`   | `UnlocksListRow[]` | The rows, already worded. |

Events: `mc-unlocks` `{ type: "row", id }`.

Needs `@mc/ui` defined.
