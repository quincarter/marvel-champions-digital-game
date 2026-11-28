# Briefing framed row

`<mc-briefing-framed-row>`

A paper row with a 2px ink frame and, when asked, a stripe down its left edge (green when a fact helps or is settled, red against). It holds what is slotted and decides nothing; the owner puts a word or a mark beside the stripe, so it is never colour alone.

## Usage

```html
<mc-briefing-framed-row></mc-briefing-framed-row>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `stripe` | attribute | `heal` | `red`; none draws no stripe. |
| `fill` | attribute | `card` (default) | `parchment` | `none`. |

## Events

- none

## Slots

- default: the row content.

## Files

- `McBriefingFramedRow.ts`: the class
- `mc-briefing-framed-row.ts`: the define file (registers the element once)
- `mc-briefing-framed-row.styles.ts`: the constructible stylesheet
- `mc-briefing-framed-row.types.ts`: the property and event types
- `__tests__/`: the tests
