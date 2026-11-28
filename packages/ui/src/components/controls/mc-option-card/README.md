# mc-option-card

One option with its controls: a toggle card, a stepper, or chips in one or several labeled groups. Every control raises `mc-pressed` with its action string.

## Usage

```ts
html`<mc-option-card .row=${row} ?compact=${phone} stop-prefix="option:"></mc-option-card>`;
```

## Properties

| Name          | Type                   | Meaning                                |
| ------------- | ---------------------- | -------------------------------------- |
| `row`         | McOptionRow (property) | name, meta, active and the control.    |
| `compact`     | boolean                | The phone's stacked arrangement.       |
| `stop-prefix` | string                 | What a control's stop key starts with. |

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`. `action` is whatever the owner set; `hold` is true for a hold or Inspect.

## Slots

None.
