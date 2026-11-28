# mc-pause-log-line

A log line Undo can get back to: outlined, marked ↶, a full touch target tall. A press rewinds to it.

## Usage

```ts
html`<mc-pause-log-line .line=${line}></mc-pause-log-line>`;
```

## Properties

| Name   | Type                | Meaning                                     |
| ------ | ------------------- | ------------------------------------------- |
| `line` | `PauseLogLineInput` | The line; its stop and action come from it. |

## Events

`mc-pressed` (bubbles, composed): `{ action: { type: "moment", id }, hold }`.

## Slots

None. Focus stop: the line's `stop` (`moment:<id>`).
