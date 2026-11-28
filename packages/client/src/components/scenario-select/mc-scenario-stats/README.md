# Scenario stats

`<mc-scenario-stats>`

The bordered parchment band of the picked scenario's numbers: main scheme, starting threat, villain HP and encounter
sets, four across (`wide`) or two by two. Reads the same detail the stages panel does, so the two can't disagree.

## Usage

```html
<mc-scenario-stats></mc-scenario-stats>
```

## Properties

| Name    | Kind      | What it is                                         |
| ------- | --------- | -------------------------------------------------- |
| `cells` | property  | `ScenarioStatCell[]`; nothing is drawn when empty. |
| `wide`  | attribute | Four cells across instead of two by two.           |

## Events

None.

## Files

- `McScenarioStats.ts`: the class
- `mc-scenario-stats.ts`: the define file (registers the element once)
- `mc-scenario-stats.styles.ts`: the constructible stylesheet
- `mc-scenario-stats.types.ts`: the property and event types
- `__tests__/`: the tests
