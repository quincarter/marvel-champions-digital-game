# Scenario picked

`<mc-scenario-picked>`

The ink "scenario stages" panel for the picked scenario: a box per stage (the one this difficulty plays is bright), the
played record and the encounter and modular sets. A wide screen shows it open as a side column. A narrow one makes it a
disclosure: shut it is one bar (the `stages-toggle` stop), open it is a sheet over the list with the stat strip inside,
rising from that same bar so opening and closing never moves what was tapped.

## Usage

```html
<mc-scenario-picked></mc-scenario-picked>
```

## Properties

| Name    | Kind      | What it is                                       |
| ------- | --------- | ------------------------------------------------ |
| `model` | property  | `ScenarioPickedModel`.                           |
| `wide`  | attribute | The side column's arrangement (set by the page). |

## Events

- `mc-scenario-select`: `{ type: "press", key: "stages-toggle" }`.

## Files

- `McScenarioPicked.ts`: the class
- `mc-scenario-picked.ts`: the define file (registers the element once)
- `mc-scenario-picked.styles.ts`: the constructible stylesheet
- `mc-scenario-picked.types.ts`: the property and event types
- `__tests__/`: the tests
