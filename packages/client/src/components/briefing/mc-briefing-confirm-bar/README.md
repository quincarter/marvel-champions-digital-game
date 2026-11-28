# Briefing confirm bar

`<mc-briefing-confirm-bar>`

The Back / Confirm bar under a confirm step: only Confirm records the answer, Back returns to the choice. An optional quiet Inspect button sits with them. Confirm is the forward button of the screen, so it carries the pad Start glyph.

## Usage

```html
<mc-briefing-confirm-bar></mc-briefing-confirm-bar>
```

## Properties

| Name    | Kind     | What it is         |
| ------- | -------- | ------------------ |
| `model` | property | `ConfirmBarModel`. |

## Events

- `mc-briefing-step`: `{ type: "back" | "confirm" | "read" }`, for the call that owns the step.

## Files

- `McBriefingConfirmBar.ts`: the class
- `mc-briefing-confirm-bar.ts`: the define file (registers the element once)
- `mc-briefing-confirm-bar.styles.ts`: the constructible stylesheet
- `mc-briefing-confirm-bar.types.ts`: the property and event types
- `__tests__/`: the tests
