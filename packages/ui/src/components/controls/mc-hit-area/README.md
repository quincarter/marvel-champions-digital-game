# mc-hit-area

An invisible press area laid over part of another control, as a sibling of it so a tap is not also a tap on the control under it. Size and place it with CSS.

## Usage

```ts
html`<mc-hit-area style="inset:0 auto 0 0;width:40px" .action=${"cards"}></mc-hit-area>`;
```

Press controls take no keyboard focus: the screen's focus route presses them (`press()`, `click()`) and, where there is a hold action, Inspects them (`inspect()`). A tap is a press and release on the control with nothing scrolled between (`shared/tap.ts`), never the lift that ends a swipe.

## Properties

None besides the press ones (`data-stop`, `action`, `holdAction`, `disabled`).

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`. `action` is whatever the owner set; `hold` is true for a hold or Inspect.

## Slots

None.
