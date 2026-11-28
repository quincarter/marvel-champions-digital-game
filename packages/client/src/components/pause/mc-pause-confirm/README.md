# mc-pause-confirm

The confirm dialog over Pause (Concede, or a guest leaving the seat): a sentence and two buttons over a dim backdrop that covers the sheet.

## Usage

```ts
html`<mc-pause-confirm .input=${model.confirm}></mc-pause-confirm>`;
```

## Properties

| Name    | Type                | Meaning                                       |
| ------- | ------------------- | --------------------------------------------- |
| `input` | `PauseConfirmInput` | The sentence and the labels; none: no dialog. |

## Events

`mc-pause` (bubbles, composed): `{ type: "menu", id: "concede-confirm-yes" | "concede-confirm-cancel" }`.

## Slots

None. Focus stops: `concede-confirm-yes`, `concede-confirm-cancel`.
