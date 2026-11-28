# Briefing mission

`<mc-briefing-mission>`

The mission section (Age of Apocalypse, MC45 p. 5): this scenario drawn mission and Overseer, which Prelate is absent in scenario 3, a retry earlier draws and the penalties carried over. Nothing here decides what was drawn.

## Usage

```html
<mc-briefing-mission></mc-briefing-mission>
```

## Properties

| Name      | Kind     | What it is         |
| --------- | -------- | ------------------ |
| `mission` | property | `MissionBriefing`. |

## Events

- `mc-briefing`: `{ type: "inspect", cardId, name }`.

## Files

- `McBriefingMission.ts`: the class
- `mc-briefing-mission.ts`: the define file (registers the element once)
- `mc-briefing-mission.styles.ts`: the constructible stylesheet
- `mc-briefing-mission.types.ts`: the property and event types
- `__tests__/`: the tests
