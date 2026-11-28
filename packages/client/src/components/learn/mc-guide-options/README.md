# mc-guide-options

The first-run chooser's column: a subtitle over the three guide levels as radio cards.

## Usage

```ts
html`<mc-guide-options
  subtitle="Pick how much help you want."
  .options=${options}
  .chips=${lessonChips}
></mc-guide-options>`;
```

Each card is an `mc-guide-option` (a focus stop `option:<value>`). The recommended card holds the lesson `chips` (small `mc-stamp`s) when there are any.

## Properties

| Name       | Type               | Meaning                                           |
| ---------- | ------------------ | ------------------------------------------------- |
| `subtitle` | string             | The line over the cards, already translated.      |
| `options`  | GuideOptionModel[] | The cards; the chosen one is marked in its model. |
| `chips`    | string[]           | The lesson chips for the recommended card.        |

## Events

`mc-learn` (bubbles, composed): `{ type: "option", value }`.

## Slots

None.
