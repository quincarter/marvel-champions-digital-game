# mc-pause-link-row

A row that opens something: a Quick reference row, a compact cell on the Reference toggle's line, or a search result with what matched marked.

## Usage

```ts
html`<mc-pause-link-row .row=${row}></mc-pause-link-row>`;
```

## Properties

| Name      | Type                           | Meaning                                    |
| --------- | ------------------------------ | ------------------------------------------ |
| `row`     | `PauseLinkInput`               | The row; its stop and action come from it. |
| `variant` | `panel` / `compact` / `result` | Reflected from the row.                    |

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`; the section above turns it into `mc-pause`.

## Slots

None. Focus stop: the row's `stop`.
