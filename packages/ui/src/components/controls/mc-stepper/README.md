# mc-stepper

Previous, what is chosen, next: two fixed-width arrow chips either side of a chip that says the choice. With one choice only the chip shows.

## Usage

```ts
html`<mc-stepper
  label="Rhino"
  prev-stop="focus:previous"
  next-stop="focus:next"
  .prevAction=${{ dir: -1 }}
  .nextAction=${{ dir: 1 }}
></mc-stepper>`;
```

## Properties

| Name                                | Type                    | Meaning                                        |
| ----------------------------------- | ----------------------- | ---------------------------------------------- |
| `label`                             | string                  | The choice's words, already translated.        |
| `prev-stop / next-stop / name-stop` | string                  | Focus stop keys (the middle one may be empty). |
| `prevAction / nextAction`           | unknown (property)      | What a tap on an arrow raises.                 |
| `prevGlyph / nextGlyph`             | ControlGlyph (property) | The key or pad glyph on an arrow.              |
| `several`                           | boolean                 | False: no arrows (true).                       |

## Events

`mc-pressed` (bubbles, composed) from an arrow: `{ action, hold: false }`.

## Slots

None.
