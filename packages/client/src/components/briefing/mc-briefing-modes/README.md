# Briefing modes

`<mc-briefing-modes>`

The mode section: a heading and one row per mode, its name and line of state over full-size chips (ink when chosen, the state in words as well as in colour). A chip the model disables is shown and takes no press.

## Usage

```html
<mc-briefing-modes></mc-briefing-modes>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `rows` | property | `IssueModeRow[]`. |

## Events

- `mc-briefing`: `{ type: "set-mode", action }`.

## Files

- `McBriefingModes.ts`: the class
- `mc-briefing-modes.ts`: the define file (registers the element once)
- `mc-briefing-modes.styles.ts`: the constructible stylesheet
- `mc-briefing-modes.types.ts`: the property and event types
- `__tests__/`: the tests
