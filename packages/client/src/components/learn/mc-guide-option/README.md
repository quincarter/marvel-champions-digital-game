# mc-guide-option

One guide level the first-run chooser offers, as a radio card.

## Usage

```ts
html`<mc-guide-option
  .model=${{ value: "full", label: "Learn as you play", body: "A real first game.", selected: true, recommended: true, recommendedLabel: "RECOMMENDED" }}
>
  <div class="chips">…</div>
</mc-guide-option>`;
```

A radio dot, the name and one line, a RECOMMENDED stamp on the guide's pick and a slot under the words (the lesson chips). The chosen card has a filled dot, a heavy red outline and `aria-checked`, so it never rests on colour alone. It is a press control: the focus stop is `option:<value>`, set from the model; the route presses it with `click()`; a tap is a press and release on it, never the lift that ends a swipe.

## Properties

| Name       | Type             | Meaning                          |
| ---------- | ---------------- | -------------------------------- |
| `model`    | GuideOptionModel | The card, already translated.    |
| `selected` | boolean          | Reflected from `model.selected`. |

## Events

`mc-pressed` (bubbles, composed): `{ action: { type: "option", value }, hold: false }`.

## Slots

- `(default)`: under the words (the lesson chips).
