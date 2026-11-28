# Scenario chips

`<mc-scenario-chips>`

The product chips of Choose a scenario: one `mc-filter-chip` per pack, as wide as its words, wrapped over as many rows
as it takes (a wide screen) or one row that scrolls sideways (`rail`: a phone or a tablet). A chosen chip leads with a
check, so the state never rests on color alone. Each chip is a focus stop, `scenario-chip:<id>`.

## Usage

```html
<mc-scenario-chips></mc-scenario-chips>
```

## Properties

| Name    | Kind      | What it is                                |
| ------- | --------- | ----------------------------------------- |
| `chips` | property  | `ScenarioChip[]`, in order.               |
| `rail`  | attribute | One sideways row instead of wrapped rows. |

## Events

- `mc-scenario-select`: `{ type: "press", key: "scenario-chip:<id>" }`.

## Files

- `McScenarioChips.ts`: the class
- `mc-scenario-chips.ts`: the define file (registers the element once)
- `mc-scenario-chips.styles.ts`: the constructible stylesheet
- `mc-scenario-chips.types.ts`: the property and event types
- `__tests__/`: the tests
