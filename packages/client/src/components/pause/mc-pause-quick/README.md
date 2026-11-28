# mc-pause-quick

The phone's Reference group: a toggle sharing a line with the compact cells, and the Reference rows under it while open.

## Usage

```ts
html`<mc-pause-quick .input=${model.quick}></mc-pause-quick>`;
```

## Properties

| Name    | Type              | Meaning                  |
| ------- | ----------------- | ------------------------ |
| `input` | `PauseQuickInput` | The toggle and the rows. |

## Events

`mc-pause` (bubbles, composed): `{ type: "quick-toggle" }` or a row's `{ type: "quick", id }`.

## Slots

None. Focus stops: `quick-toggle` and each row's.
