# Scenario actions

`<mc-scenario-actions>`

The foot of the screen: "Customize this scenario" when the scenario can be customized, the red "Choose heroes" call to
action and a small caption under it. On a wide screen it sits at the foot of the ink panel (`ground="ink"`, paper
words); on a narrow one it is on the page's own ground. Focus stops `customize` and `next`; `next` stays a stop while
dimmed (it says why in its tooltip), as the pad route's primary only goes forward when it can.

## Usage

```html
<mc-scenario-actions></mc-scenario-actions>
```

## Properties

| Name     | Kind      | What it is                              |
| -------- | --------- | --------------------------------------- |
| `model`  | property  | `ScenarioActionsModel`.                 |
| `ground` | attribute | `ink` (the wide side panel) or `paper`. |

## Events

- `mc-scenario-select`: `{ type: "press", key: "customize" | "next" }`.

## Files

- `McScenarioActions.ts`: the class
- `mc-scenario-actions.ts`: the define file (registers the element once)
- `mc-scenario-actions.styles.ts`: the constructible stylesheet
- `mc-scenario-actions.types.ts`: the property and event types
- `__tests__/`: the tests
