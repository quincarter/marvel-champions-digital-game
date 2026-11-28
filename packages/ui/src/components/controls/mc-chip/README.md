# mc-chip

A chip or segment: ink fill and paper words when chosen, paper and ink words otherwise. `link` draws words only.

## Usage

```ts
html`<mc-chip label="II" ?selected=${on} data-stop="option:set-ii" .action=${"set-ii"}></mc-chip>`;
```

Press controls take no keyboard focus: the screen's focus route presses them (`press()`, `click()`) and, where there is a hold action, Inspects them (`inspect()`). A tap is a press and release on the control with nothing scrolled between (`shared/tap.ts`), never the lift that ends a swipe.

## Properties

| Name | Type | Meaning |
| --- | --- | --- |
| `label` | string | Its words, already translated. |
| `selected` | boolean | Chosen. |
| `link` | boolean | Words only, no box. |
| `disabled` | boolean | Dimmed; a press does nothing. |
| `data-stop` | string | Its focus stop's key. |
| `action` | unknown (property) | What a tap raises. |
| `holdAction` | unknown (property) | What a hold or Inspect raises. |

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`. `action` is whatever the owner set; `hold` is true for a hold or Inspect.

## Slots

None.
