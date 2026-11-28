# mc-extras-doors

The two doors out of Extras, side by side: the Trophy Room and Art and Credits. Focus stops `trophies` and `credits`. In the `stacked` layout (set by the page: a phone, or a rail too narrow to print every tab beside them) each door takes half the row; otherwise each is 150px wide.

## Properties

| Name             | Type   | Meaning                       |
| ---------------- | ------ | ----------------------------- |
| `trophies-label` | string | The Trophy Room door's words. |
| `credits-label`  | string | The Credits door's words.     |

## Events

`mc-extras` `{ type: "door", id: "trophies" | "credits" }`.
