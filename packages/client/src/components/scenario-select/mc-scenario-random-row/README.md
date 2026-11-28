# Scenario random row

`<mc-scenario-random-row>`

The strip above the shelves: "Random box" and "Random scenario" on the full list; drilled into a box, "◂ All packs",
the box's name and "Random villain". Each button is a focus stop (`drill-back`, `random-box`, `random-scenario`,
`random-villain`) and a press.

## Usage

```html
<mc-scenario-random-row></mc-scenario-random-row>
```

## Properties

| Name    | Kind     | What it is                |
| ------- | -------- | ------------------------- |
| `model` | property | `ScenarioRandomRowModel`. |

## Events

- `mc-scenario-select`: `{ type: "press", key }`.

## Files

- `McScenarioRandomRow.ts`: the class
- `mc-scenario-random-row.ts`: the define file (registers the element once)
- `mc-scenario-random-row.styles.ts`: the constructible stylesheet
- `mc-scenario-random-row.types.ts`: the property and event types
- `__tests__/`: the tests
