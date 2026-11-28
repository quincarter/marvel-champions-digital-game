# mc-learn-header

The ink bar of a learning screen (How to win, How to play): the close ×, the title with its Cancel glyph, and optional progress ticks.

## Usage

```ts
html`<mc-learn-header
  heading="Lesson 1 of 5"
  close-label="Back"
  .ticks=${{ count: 5, filled: 1, label: "Lesson 1 of 5" }}
></mc-learn-header>`;
```

The scene sizes it (`bar-height`, `pad`, `title-size`) and tells it where the dark mode tab leaves room for the title (`drop`, `max`, from `sheetThemeFor`). The close is the focus stop `close`. A screen-specific section: it builds on the generic `mc-close-bar` and `mc-step-ticks` of `@mc/ui`.

## Properties

| Name          | Type             | Meaning                                     |
| ------------- | ---------------- | ------------------------------------------- |
| `heading`     | string           | The title, already translated.              |
| `close-label` | string           | The close control's accessible name.        |
| `glyph`       | ControlGlyph     | The Cancel glyph after the title, or none.  |
| `ticks`       | LearnHeaderTicks | The progress strip, or none.                |
| `drop`        | number           | Px the title drops under the dark mode tab. |
| `max`         | number           | Px the title may take (0: no limit).        |
| `bar-height`  | number           | The bar's height in px (56).                |
| `pad`         | number           | The bar's side padding in px (16).          |
| `title-size`  | number           | The title's size in px (22).                |

## Events

`mc-learn` (bubbles, composed): `{ type: "close" }`.

## Slots

None.
