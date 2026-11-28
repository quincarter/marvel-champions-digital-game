# mc-press-card

A framed white card that is itself a control: a thin outline, or a red border when chosen.

## Usage

```ts
html`<mc-press-card ?selected=${on} .action=${"pick"}><div class="name">Standard</div></mc-press-card>`;
```

Press controls take no keyboard focus: the screen's focus route presses them (`press()`, `click()`) and, where there is a hold action, Inspects them (`inspect()`). A tap is a press and release on the control with nothing scrolled between (`shared/tap.ts`), never the lift that ends a swipe.

## Properties

| Name       | Type    | Meaning                 |
| ---------- | ------- | ----------------------- |
| `selected` | boolean | Chosen: the red border. |
| `dim`      | boolean | Unavailable: faded.     |

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`. `action` is whatever the owner set; `hold` is true for a hold or Inspect.

## Slots

- `(default)`: The card's content.
