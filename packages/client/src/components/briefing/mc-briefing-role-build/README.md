# Briefing role-building

`<mc-briefing-role-build>`

Role-building (MC32 p. 5): each player may take up to 1 event and 1 upgrade from their role two aspects. The call takes the whole screen under its head: an intro, the aspect filter chips, the card list in its own native scroller and Decline pinned at the foot; a card taken opens the confirm step instead, with Confirm pinned.

## Usage

```html
<mc-briefing-role-build></mc-briefing-role-build>
```

## Properties

| Name    | Kind     | What it is            |
| ------- | -------- | --------------------- |
| `model` | property | `RoleBuildCallModel`. |

## Events

- `mc-briefing`: `{ type: "answer", picked }`, or an `inspect`.

## Files

- `McBriefingRoleBuild.ts`: the class
- `mc-briefing-role-build.ts`: the define file (registers the element once)
- `mc-briefing-role-build.styles.ts`: the constructible stylesheet
- `mc-briefing-role-build.types.ts`: the property and event types
- `__tests__/`: the tests
