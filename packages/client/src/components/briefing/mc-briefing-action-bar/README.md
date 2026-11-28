# Briefing action bar

`<mc-briefing-action-bar>`

The ink bar at the foot: EDIT DECKS (a phone: DECKS) and the one red OPEN ISSUE button. Beside the buttons on a wide screen it says why Open waits in red words or, with nothing to say, holds the watch toggle. Open stays in place, dimmed, while it cannot be pressed, and is a focus stop (`open`) only when it can.

## Usage

```html
<mc-briefing-action-bar></mc-briefing-action-bar>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `model` | property | `ActionBarModel`. |
| `phone` | attribute | Two equal buttons across the bar; the reason and the toggle are on the strip above. |

## Events

- `mc-briefing`: `{ type: "edit-decks" }`, `{ type: "open" }`, `{ type: "watch" }`.

## Files

- `McBriefingActionBar.ts`: the class
- `mc-briefing-action-bar.ts`: the define file (registers the element once)
- `mc-briefing-action-bar.styles.ts`: the constructible stylesheet
- `mc-briefing-action-bar.types.ts`: the property and event types
- `__tests__/`: the tests
