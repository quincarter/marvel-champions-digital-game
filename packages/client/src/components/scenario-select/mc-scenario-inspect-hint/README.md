# Scenario inspect hint

`<mc-scenario-inspect-hint>`

The pad's View glyph and the word "Inspect" beside the Filters button (a controller is in use, and Y is the filters'
fold, so View opens Inspect here). Drawn only with a glyph.

## Usage

```html
<mc-scenario-inspect-hint></mc-scenario-inspect-hint>
```

## Properties

| Name    | Kind      | What it is                              |
| ------- | --------- | --------------------------------------- |
| `text`  | attribute | The word, already translated.           |
| `glyph` | property  | `HintGlyph`, or null for nothing drawn. |

## Events

None.

## Files

- `McScenarioInspectHint.ts`: the class
- `mc-scenario-inspect-hint.ts`: the define file (registers the element once)
- `mc-scenario-inspect-hint.styles.ts`: the constructible stylesheet
- `mc-scenario-inspect-hint.types.ts`: the property and event types
- `__tests__/`: the tests
