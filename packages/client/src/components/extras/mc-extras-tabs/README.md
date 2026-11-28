# mc-extras-tabs

The tab rail of the eight shelves (the generic `mc-tab-rail` from `@mc/ui`), with the LB / RB hint under its right end while a pad is in use. Each tab is a focus stop, `tab:<id>`.

## Properties

| Name       | Type           | Meaning                                              |
| ---------- | -------------- | ---------------------------------------------------- |
| `tabs`     | `TabRailTab[]` | One per shelf, labelled "Stories 3/10" (phone: short). |
| `selected` | string         | The chosen tab's id.                                 |
| `size`     | number         | The label size in px (0: the button's own).          |
| `hint`     | `ControlGlyph` | LB / RB under the right end, or undefined.           |

## Events

`mc-extras` `{ type: "tab", id }`.
