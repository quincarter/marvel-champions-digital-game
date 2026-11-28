# Briefing role confirm

`<mc-briefing-role-confirm>`

The role call confirm step ("COLOSSUS WILL BE THE BRAWLER"): the role aspect chips, summary, how it sits against the seat deck and what a role does, with the Back / Confirm bar under it. Only Confirm records the role.

## Usage

```html
<mc-briefing-role-confirm></mc-briefing-role-confirm>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `model` | property | `RoleConfirmModel`. |

## Events

- `mc-briefing-step`: `{ type: "back" | "confirm" }`.

## Files

- `McBriefingRoleConfirm.ts`: the class
- `mc-briefing-role-confirm.ts`: the define file (registers the element once)
- `mc-briefing-role-confirm.styles.ts`: the constructible stylesheet
- `mc-briefing-role-confirm.types.ts`: the property and event types
- `__tests__/`: the tests
