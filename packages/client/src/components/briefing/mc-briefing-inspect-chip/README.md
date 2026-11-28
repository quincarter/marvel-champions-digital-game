# Briefing inspect chip

`<mc-briefing-inspect-chip>`

A quiet full-size button that opens one card in Inspect (the chip on a mission row, a carried-in card name). A tap or a hold raises `mc-pressed` with an `inspect` action and answers nothing. Its focus stop is the `stop` it is given.

## Usage

```html
<mc-briefing-inspect-chip></mc-briefing-inspect-chip>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `label` | attribute | The words, already translated. |
| `card` | property | `{ cardId, name }` it opens. |
| `stop` | attribute | The focus stop key (`data-stop`). |

## Events

- `mc-pressed`: `PressDetail` whose `action` is `{ type: "inspect", cardId, name }` (the owning section relays it as `mc-briefing`).

## Files

- `McBriefingInspectChip.ts`: the class
- `mc-briefing-inspect-chip.ts`: the define file (registers the element once)
- `mc-briefing-inspect-chip.styles.ts`: the constructible stylesheet
- `mc-briefing-inspect-chip.types.ts`: the property and event types
- `__tests__/`: the tests
