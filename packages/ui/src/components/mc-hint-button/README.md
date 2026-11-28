# Hint button

`<mc-hint-button>`

An `mc-button` that carries a key or pad glyph beside its word while a keyboard or controller is in use (the word
keeps clear of it); with no glyph it is the plain button. The button is pressed by a tap only, as ever.

## Usage

```html
<mc-hint-button></mc-hint-button>
```

## Properties

| Name        | Kind      | What it is                                      |
| ----------- | --------- | ----------------------------------------------- |
| `kind`      | attribute | As `mc-button`.                                 |
| `label`     | attribute | The word, already translated.                   |
| `selected`  | attribute | On.                                             |
| `disabled`  | attribute | Unavailable (dimmed); `reason` is its tooltip.  |
| `pressable` | attribute | With `disabled`: a tap still raises `mc-press`. |
| `display`   | attribute | A Bangers label.                                |
| `plain`     | attribute | A label in its own case.                        |
| `glyph`     | property  | `HintGlyph`, or null for none.                  |

## Events

- `mc-press`: A tap on an enabled button (from the inner `mc-button`, re-raised unchanged).

## Files

- `McHintButton.ts`: the class
- `mc-hint-button.ts`: the define file (registers the element once)
- `mc-hint-button.styles.ts`: the constructible stylesheet
- `mc-hint-button.types.ts`: the property and event types
- `__tests__/`: the tests
