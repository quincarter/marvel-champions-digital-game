# Briefing role tiles

`<mc-briefing-role-tiles>`

The role call (MC32 p. 5): four explainer tiles and the "What roles do" note. A tap selects a role and the call opens its confirm step; a role an earlier seat holds is shown, spelled out, and cannot be picked.

## Usage

```html
<mc-briefing-role-tiles></mc-briefing-role-tiles>
```

## Properties

| Name    | Kind     | What it is        |
| ------- | -------- | ----------------- |
| `model` | property | `RoleTilesModel`. |

## Events

- `mc-briefing-step`: `{ type: "role", id }`.

## Files

- `McBriefingRoleTiles.ts`: the class
- `mc-briefing-role-tiles.ts`: the define file (registers the element once)
- `mc-briefing-role-tiles.styles.ts`: the constructible stylesheet
- `mc-briefing-role-tiles.types.ts`: the property and event types
- `__tests__/`: the tests
