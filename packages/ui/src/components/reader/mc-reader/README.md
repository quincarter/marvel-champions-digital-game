# mc-reader

The frame of a reading screen: a bar, an optional toolbar, then a side pane (the contents) beside a main pane (the text) with an optional foot under it. Layout is CSS only; the screen decides what goes in each slot.

## Properties

| Name      | Type                 | Meaning                                                       |
| --------- | -------------------- | ------------------------------------------------------------- |
| `wide`    | boolean              | The side pane sits beside the main pane (else one at a time). |
| `pane`    | `"side"` or `"main"` | Narrow only: which pane shows.                                |
| `no-side` | boolean              | No side pane at all (a screen with no contents).              |

## Slots

`bar`, `toolbar`, `side`, `main`, `foot`.

## Events

None.
