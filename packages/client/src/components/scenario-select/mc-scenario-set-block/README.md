# Scenario set block

`<mc-scenario-set-block>`

A label over a value on the ink panel ("ENCOUNTER SETS" over their names, "RECOMMENDED MODULAR" over the modular
sets), as Take your seats prints its obligation and nemesis set.

## Usage

```html
<mc-scenario-set-block></mc-scenario-set-block>
```

## Properties

| Name      | Kind      | What it is                     |
| --------- | --------- | ------------------------------ |
| `heading` | attribute | The label, already translated. |
| `value`   | attribute | The names, already translated. |

## Events

None.

## Files

- `McScenarioSetBlock.ts`: the class
- `mc-scenario-set-block.ts`: the define file (registers the element once)
- `mc-scenario-set-block.styles.ts`: the constructible stylesheet
- `mc-scenario-set-block.types.ts`: the property and event types
- `__tests__/`: the tests
