# Briefing options

`<mc-briefing-options>`

A plain pick of options (single or multi): one button per option in a wrapped grid, each option beside its card picture when every option is a card. A multi pick toggles and Confirm submits; an optional pick adds Decline; a random draw is "Take it" and Decline.

## Usage

```html
<mc-briefing-options></mc-briefing-options>
```

## Properties

| Name    | Kind     | What it is      |
| ------- | -------- | --------------- |
| `model` | property | `OptionsModel`. |

## Events

- `mc-briefing`: `{ type: "answer", picked }`, or an `inspect`.

## Files

- `McBriefingOptions.ts`: the class
- `mc-briefing-options.ts`: the define file (registers the element once)
- `mc-briefing-options.styles.ts`: the constructible stylesheet
- `mc-briefing-options.types.ts`: the property and event types
- `__tests__/`: the tests
