# mc-check-row

A checkbox row with a name over a line of detail and an optional picture at its end; `locked` is a required, inert choice.

## Usage

```ts
html`<mc-check-row name="Bomb Scare" meta="6 cards" ?checked=${on} .action=${"toggle"}><img slot="end" /></mc-check-row>`;
```

Press controls take no keyboard focus: the screen's focus route presses them (`press()`, `click()`) and, where there is a hold action, Inspects them (`inspect()`). A tap is a press and release on the control with nothing scrolled between (`shared/tap.ts`), never the lift that ends a swipe.

## Properties

| Name | Type | Meaning |
| --- | --- | --- |
| `name` | string | The row's name. |
| `meta` | string | The line under it. |
| `checked` | boolean | Ticked. |
| `locked` | boolean | Required: ink fill, never pressable. |

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`. `action` is whatever the owner set; `hold` is true for a hold or Inspect.

## Slots

- `end`: A picture at the row's end.
