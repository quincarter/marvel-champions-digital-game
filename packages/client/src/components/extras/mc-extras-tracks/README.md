# mc-extras-tracks

The Music tab's songs, one `mc-extras-track` each, scrolling natively. Every song is a focus stop, `tile:<id>`, earned or not: a locked row opens nothing but says what opens it. It relays the rows' presses as `mc-extras` (`ExtrasRelay`).

## Properties

| Name     | Type                | Meaning                 |
| -------- | ------------------- | ----------------------- |
| `tracks` | `ExtrasTrackItem[]` | `{ id, row }` per song. |
| `empty`  | string              | What it says with none. |

## Events

`mc-extras` `{ type: "tile", id }`. `scroller` gives the list's scrolling element.
