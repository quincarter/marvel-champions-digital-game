# mc-pause-table

The phone's inline settings: the guided run's buttons, the Table group (card size and a switch per setting) and the Guide group (the level tiles and the guide rows).

## Usage

```ts
html`<mc-pause-table .input=${model.table}></mc-pause-table>`;
```

## Properties

| Name    | Type              | Meaning     |
| ------- | ----------------- | ----------- |
| `input` | `PauseTableInput` | The groups. |

## Events

`mc-pause` (bubbles, composed): `card-size`, `table`, `guide-level`, `guide`, or `{ type: "menu" }` for the guided run's buttons.

## Slots

None. Focus stops: `guide-stop-tutorial`, `guide-turn-guide-off`, `table:card-size:<size>`, `table:<row>`, `guide:guide-level:<level>`, `guide:<row>`.
