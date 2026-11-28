# mc-aspect-row

One of the four playable aspects on the How to play hub: its chip, its tagline, and a ✓ DONE or a quiet "▸".

## Usage

```ts
html`<mc-aspect-row
  .model=${{ aspect: "justice", name: "Justice", tagline: "Thwarting", done: false, doneLabel: "✓ Done" }}
></mc-aspect-row>`;
```

The row is a focus stop `aspect:<aspect>` (an `mc-link-row` inside) and the chip carries the aspect's name, so the colour is never the only signal.

## Properties

| Name    | Type           | Meaning                      |
| ------- | -------------- | ---------------------------- |
| `model` | AspectRowModel | The row, already translated. |

## Events

`mc-pressed` (bubbles, composed): `{ action: { type: "aspect", aspect }, hold: false }`.

## Slots

None.
