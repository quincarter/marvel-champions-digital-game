# Top bar

`<mc-top-bar>`

The ink bar across the top of a setup-flow screen: a boxed Back button (with its Cancel glyph while a keyboard or pad
is in use), the Bangers title and a small uppercase label at the right edge. The dark mode tab hangs from the top
centre of the screen: the screen says how far the title drops to clear it (`title-drop`) or where it must end
(`title-max-right`), as the client's `sheetThemeFor` rule works them out.

The bar fills the height its parent gives it. A tap on Back raises `mc-press` (the inner button's; a focus stop's
`click()` on the `back` button raises it too).

## Usage

```html
<mc-top-bar></mc-top-bar>
```

## Properties

| Name              | Kind      | What it is                                                              |
| ----------------- | --------- | ----------------------------------------------------------------------- |
| `back-label`      | attribute | The Back button word; no button when empty.                             |
| `back-stop`       | attribute | The `data-stop` key of the Back button ("back").                        |
| `heading`         | attribute | The page title, already translated.                                     |
| `right`           | attribute | The small label at the right edge, already translated.                  |
| `compact`         | attribute | A phone's smaller bar (a 22px title, 12px padding, a glyph-less Back).  |
| `title-drop`      | attribute | How far the title drops (px) to sit under the dark mode tab.            |
| `title-max-right` | attribute | Where the title must end (px from the bar's left edge); 0 for no limit. |
| `backGlyph`       | property  | The Back button's glyph (`HintGlyph`), or null.                         |

## Slots

- `end`: A control at the bar's right end (Past games' "Open a replay file", the Trophy Room's "Your stats").

## Events

- `mc-press`: A tap on Back.

## Files

- `McTopBar.ts`: the class
- `mc-top-bar.ts`: the define file (registers the element once)
- `mc-top-bar.styles.ts`: the constructible stylesheet
- `mc-top-bar.types.ts`: the property and event types
- `__tests__/`: the tests
