# Scenario record

`<mc-scenario-record>`

The played record as a filled band at menu-button size so it reads from the couch: win-state green once beaten, a deep
red when played but never won, the advisory yellow before it has been played. The tone is the fill and the words say
the same thing, so the state never rests on color alone.

## Usage

```html
<mc-scenario-record></mc-scenario-record>
```

## Properties

| Name      | Kind      | What it is                                             |
| --------- | --------- | ------------------------------------------------------ |
| `label`   | attribute | "RECORD", already translated.                          |
| `tally`   | attribute | "3 wins · 1 loss", or "Not played yet".                |
| `subline` | attribute | A second line ("Best clear: round 6"); empty for none. |
| `tone`    | attribute | `beaten`                                               | `played` | `unplayed`. |

## Events

None.

## Files

- `McScenarioRecord.ts`: the class
- `mc-scenario-record.ts`: the define file (registers the element once)
- `mc-scenario-record.styles.ts`: the constructible stylesheet
- `mc-scenario-record.types.ts`: the property and event types
- `__tests__/`: the tests
