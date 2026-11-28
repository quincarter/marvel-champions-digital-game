# mc-segment-cell

One cell of a segmented control on an ink ground. Chosen, it is caution yellow with a tick before its label.

## Usage

```ts
html`<mc-segment-cell
  label="Large"
  ?selected=${on}
  data-stop="table:card-size:large"
  .action=${"large"}
></mc-segment-cell>`;
```

## Properties

| Name        | Type            | Meaning                                |
| ----------- | --------------- | -------------------------------------- |
| `label`     | string          | The cell's words, already translated.  |
| `detail`    | string          | A tile's second line (`look="tile"`).  |
| `selected`  | boolean         | Chosen.                                |
| `look`      | `cell` / `tile` | One centred line, or label and detail. |
| `data-stop` | string          | Its focus stop's key.                  |
| `action`    | unknown         | What a tap raises.                     |

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`.

## Slots

None.
