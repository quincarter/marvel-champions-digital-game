# Briefing watch toggle

`<mc-briefing-watch-toggle>`

"Let people watch this game" (#876): a ticked box and its words, one press. The tick says the state, never colour alone. A tap flips it (the lift of a swipe does not, issue #227); the scene stores the flip.

## Usage

```html
<mc-briefing-watch-toggle></mc-briefing-watch-toggle>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `label` | attribute | The words, already translated. |
| `checked` | attribute | Ticked. |
| `onink` | attribute | On the ink action bar: paper words and box. |
| `stop` | attribute | The focus stop key (`watch`). |

## Events

- `mc-pressed`: `PressDetail` whose `action` is `{ type: "watch" }`.

## Files

- `McBriefingWatchToggle.ts`: the class
- `mc-briefing-watch-toggle.ts`: the define file (registers the element once)
- `mc-briefing-watch-toggle.styles.ts`: the constructible stylesheet
- `mc-briefing-watch-toggle.types.ts`: the property and event types
- `__tests__/`: the tests
