# Briefing carry-in

`<mc-briefing-carry-in>`

One fact the side-scheme section carries in from the campaign log: its few words, a detail line and each card it names as an Inspect chip (a repeat reads times two). Framed, with no fill, so the page shows through.

## Usage

```html
<mc-briefing-carry-in></mc-briefing-carry-in>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `carry` | property | `CarryInRow`. |

## Events

- `mc-briefing`: `{ type: "inspect", cardId, name }`.

## Files

- `McBriefingCarryIn.ts`: the class
- `mc-briefing-carry-in.ts`: the define file (registers the element once)
- `mc-briefing-carry-in.styles.ts`: the constructible stylesheet
- `mc-briefing-carry-in.types.ts`: the property and event types
- `__tests__/`: the tests
