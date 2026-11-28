# mc-rules-scope

The row under the title: what the list is filtered to in words and, with a game running, the two-way toggle ("All rules" / "On your table"). The chosen option is a solid paper pill, the other an outline. Focus stops `scope:all`, `scope:table`.

## Properties

| Name      | Type                                     | Meaning                         |
| --------- | ---------------------------------------- | ------------------------------- |
| `caption` | string                                   | The filter in words.            |
| `toggle`  | `{ scope, allLabel, tableLabel }` / null | The options; null with no game. |

## Events

`mc-rules` `{ type: "scope", scope }`.
