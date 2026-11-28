# mc-unlocks-switches

The two switches above the list, Unlock everything (`row:all`) and print-and-play (`row:pnp`), each an `mc-switch-row`.

| Property       | Type                 | Meaning                    |
| -------------- | -------------------- | -------------------------- |
| `all`          | `UnlocksSwitchInput` | The Unlock everything row. |
| `printAndPlay` | `UnlocksSwitchInput` | The print-and-play row.    |

Events: `mc-unlocks` `{ type: "all" }` or `{ type: "pnp" }`.

Needs `@mc/ui` defined.
