# Briefing kicker

`<mc-briefing-kicker>`

A short label in capitals over a row or a block (a mission kind, "EVIDENCE · 1 GAINED"): the small tracked line, in Hero Red, the blue of a held value, green or the quiet ink. The words are capitalised here, so a spec reads the capitals the player does.

## Usage

```html
<mc-briefing-kicker></mc-briefing-kicker>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `text` | attribute | The words, already translated. |
| `tone` | attribute | `red` (default) | `cost` | `heal` | `ink`. |

## Events

- none

## Files

- `McBriefingKicker.ts`: the class
- `mc-briefing-kicker.ts`: the define file (registers the element once)
- `mc-briefing-kicker.styles.ts`: the constructible stylesheet
- `mc-briefing-kicker.types.ts`: the property and event types
- `__tests__/`: the tests
