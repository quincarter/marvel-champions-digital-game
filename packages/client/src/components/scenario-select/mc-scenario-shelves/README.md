# Scenario shelves

`<mc-scenario-shelves>`

The scenario list: the Random row over an `mc-shelf-roster` (one shelf per pack, each a row that scrolls sideways, the
whole stack scrolling down; or a box opened as a grid). The roster's taps and holds are re-raised as the screen's own
`mc-scenario-select`, so the scene hears one event. The tiles are focus stops `scenario:<id>`, the fold headers
`scenario-shelf:<id>`, the empty state's button `scenario-clear`, all marked by the roster.

## Usage

```html
<mc-scenario-shelves></mc-scenario-shelves>
```

## Properties

| Name    | Kind     | What it is              |
| ------- | -------- | ----------------------- |
| `model` | property | `ScenarioShelvesModel`. |

## Events

- `mc-scenario-select`: `tile` (a tile, a fold header, See all, Clear) and `inspect` (a hold or right-click).

## Files

- `McScenarioShelves.ts`: the class
- `mc-scenario-shelves.ts`: the define file (registers the element once)
- `mc-scenario-shelves.styles.ts`: the constructible stylesheet
- `mc-scenario-shelves.types.ts`: the property and event types
- `__tests__/`: the tests
