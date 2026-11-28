# mc-close-bar

The ink bar across the top of a learning screen: a close control (a drawn ×), the title with the Cancel glyph after it, and an end slot.

## Usage

```ts
html`<mc-close-bar heading="How to play" close-label="Back" .glyph=${glyph} drop="0" max="0">
  <mc-step-ticks slot="end" count="5" filled="1"></mc-step-ticks>
</mc-close-bar>`;
```

The close is an `mc-chip` (focus stop `close`, or `close-stop`); a tap raises `mc-pressed` with the action `close`. The bar's height, side padding and title size are the custom properties `--bar-height` (56px), `--bar-pad` (16px) and `--title-size` (22px).

## Properties

| Name          | Type         | Meaning                                                         |
| ------------- | ------------ | --------------------------------------------------------------- |
| `heading`     | string       | The title, already translated.                                  |
| `close-label` | string       | The close control's accessible name.                            |
| `close-stop`  | string       | Its focus stop key (default `close`).                           |
| `glyph`       | ControlGlyph | The Cancel glyph hung after the title, or none.                 |
| `drop`        | number       | Px the title drops under the dark mode tab.                     |
| `max`         | number       | Px the title may take (0: no limit), so it ends before the tab. |

## Events

`mc-pressed` (bubbles, composed) from the close: `{ action: "close", hold: false }`.

## Slots

- `end`: what sits at the bar's right end.
