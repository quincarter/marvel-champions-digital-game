# mc-guide-actions

The first-run chooser's two ways on: the red "Suit up" and, on the wide screen, a quiet "Back".

## Usage

```ts
html`<mc-guide-actions suit-label="Suit up" back-label="Back" show-back .backGlyph=${glyph}></mc-guide-actions>`;
```

Suit up is an `mc-button` (focus stop `suit-up`); Back is an `mc-chip` (focus stop `back`) with the Cancel glyph inside it while a keyboard or pad is in use, its word sliding over to make room.

## Properties

| Name         | Type         | Meaning                               |
| ------------ | ------------ | ------------------------------------- |
| `suit-label` | string       | Suit up, already translated.          |
| `back-label` | string       | Back, already translated.             |
| `show-back`  | boolean      | Back is drawn (the wide screen only). |
| `backGlyph`  | ControlGlyph | The Cancel glyph on Back, or none.    |

## Events

`mc-learn` (bubbles, composed): `{ type: "back" }`, `{ type: "suit-up" }`.

## Slots

None.
