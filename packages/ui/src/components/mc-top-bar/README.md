# Top bar

`<mc-top-bar>`

The one ink bar across the top of every screen: a boxed Back button (with its Cancel glyph while a keyboard or pad is in
use) or a drawn close ×, the Bangers title (with an optional eyebrow over it and subtitle under it), a small uppercase
caption at the right and a slot for what sits at the right end (a button, a progress strip, a tag).

## Clearing the dark mode tab

The dark mode toggle hangs from the top centre of a screen. The bar keeps its title clear of it with one rule
(`titleClearance` in `shared/title-clearance.ts`, pure and tested), fed by the shared tab box (`shared/theme-tab.ts`: the
client's theme button calls `setThemeTab` whenever it moves; a bar listens with `onThemeTabChange`):

- **A wide bar**: the title stays beside Back when the whole of it ends before the tab (or starts after it); otherwise it
  drops to its own row under the tab.
- **A narrow bar** (under 600px, a phone): the title always drops to its own row under the tab.
- The title is **never shrunk, truncated or run under the tab**. A dropped title that is wider than the bar wraps.
- A tab that ends above the bar (a bar lower on the page, such as the Deck builder's heading) is ignored.

So the bar grows taller when the title drops: give it a `min-height` (`--mc-top-bar-height`), never a fixed height, and
let its parent size it as `auto` (a flex column's `flex: none`, a grid's `auto` row). The bar finds where it sits in the
panel layer (`[data-mc-layer]`, the client's `#mc-ui`), so it can sit anywhere on a screen. `dropped` is reflected on the
host while the title is on its own row.

## Usage

```html
<mc-top-bar heading="Choose a scenario" right="Step 1 of 4" back-label="Back" @mc-press="${back}"></mc-top-bar>

<mc-top-bar variant="close" heading="Lesson 1 of 5" back-label="Back" @mc-press="${close}">
  <mc-step-ticks slot="end" count="5" filled="1" label="Lesson 1 of 5"></mc-step-ticks>
</mc-top-bar>
```

## Properties

| Name         | Kind      | What it is                                                                                            |
| ------------ | --------- | ----------------------------------------------------------------------------------------------------- |
| `variant`    | attribute | `back` (a boxed Back button, the default) or `close` (a drawn ×, the learning screens').              |
| `back-label` | attribute | The Back word, or the close × 's accessible name; no control when empty.                              |
| `back-stop`  | attribute | The `data-stop` key of that control ("back", or "close" in the close variant).                        |
| `back-name`  | attribute | The accessible name when the label is a bare arrow ("◂"); the label otherwise.                        |
| `heading`    | attribute | The page title, already translated.                                                                   |
| `eyebrow`    | attribute | A small uppercase line over the title.                                                                |
| `subtitle`   | attribute | A small line under the title.                                                                         |
| `right`      | attribute | The small caption at the right edge (a step counter, a count), already translated.                    |
| `compact`    | attribute | A phone's smaller bar (a 22px title, 12px padding, a glyph-less Back).                                |
| `italic`     | attribute | The title set in italics.                                                                             |
| `tone`       | attribute | `ink` (the default) or `paper` (no ground of its own: a page heading on the paper).                   |
| `backGlyph`  | property  | The Back button's `HintGlyph`, or null; in the close variant the `ControlGlyph` hung after the title. |

CSS custom properties: `--mc-top-bar-height` (minimum height, 60px / 52px compact), `--mc-top-bar-pad` (side padding),
`--mc-top-bar-title-size` (28px / 22px compact), `--mc-top-bar-back-min` (the Back button's minimum width, 76px).

## Slots

- `end`: what sits at the bar's right end (a button, a progress strip, a tag). Each keeps its own width.

## Events

- `mc-press`: a tap on Back or the close × (the control's `click()` from a focus stop raises it too).

## Files

- `McTopBar.ts`: the class
- `mc-top-bar.ts`: the define file (registers the element once)
- `mc-top-bar.styles.ts`: the constructible stylesheet
- `mc-top-bar.types.ts`: the close action
- `__tests__/`: the tests
