# Briefing mission row

`<mc-briefing-mission-row>`

One mission or Overseer row: a green stripe, the kind in red capitals, the card name in the display face, a short line and an Inspect chip at the right that opens the card. The row grows to hold a long line.

## Usage

```html
<mc-briefing-mission-row></mc-briefing-mission-row>
```

## Properties

| Name  | Kind     | What it is         |
| ----- | -------- | ------------------ |
| `row` | property | `MissionRowModel`. |

## Events

- `mc-briefing`: `{ type: "inspect", cardId, name }`.

## Files

- `McBriefingMissionRow.ts`: the class
- `mc-briefing-mission-row.ts`: the define file (registers the element once)
- `mc-briefing-mission-row.styles.ts`: the constructible stylesheet
- `mc-briefing-mission-row.types.ts`: the property and event types
- `__tests__/`: the tests
