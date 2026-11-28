# Scenario stat cell

`<mc-scenario-stat-cell>`

One cell of the stat strip: a small label over a display value. A value too long for the cell steps its type down
(to the caption floor) before it would need more lines than the cell has, and is never cut with an ellipsis.

## Usage

```html
<mc-scenario-stat-cell></mc-scenario-stat-cell>
```

## Properties

| Name    | Kind      | What it is                     |
| ------- | --------- | ------------------------------ |
| `label` | attribute | The label, already translated. |
| `value` | attribute | The value, already translated. |

## Events

None.

## Files

- `McScenarioStatCell.ts`: the class
- `mc-scenario-stat-cell.ts`: the define file (registers the element once)
- `mc-scenario-stat-cell.styles.ts`: the constructible stylesheet
- `mc-scenario-stat-cell.types.ts`: the property and event types
- `__tests__/`: the tests
