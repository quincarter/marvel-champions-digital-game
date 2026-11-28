# Scenario stage

`<mc-scenario-stage>`

One outlined box of the stages panel: the stage and the villain's name over its scheme, hit points and attack. The
stage the draft's difficulty plays is bright and heavy-framed; the other is dim and thin, and says so by its frame
as well as its dimness ("used now" against "the other mode").

## Usage

```html
<mc-scenario-stage></mc-scenario-stage>
```

## Properties

| Name      | Kind      | What it is                                   |
| --------- | --------- | -------------------------------------------- |
| `name`    | attribute | "I · KLAW", already translated.              |
| `stats`   | attribute | "SCH 2 · HP 12 · ATK 3", already translated. |
| `current` | attribute | The stage this difficulty plays.             |

## Events

None.

## Files

- `McScenarioStage.ts`: the class
- `mc-scenario-stage.ts`: the define file (registers the element once)
- `mc-scenario-stage.styles.ts`: the constructible stylesheet
- `mc-scenario-stage.types.ts`: the property and event types
- `__tests__/`: the tests
