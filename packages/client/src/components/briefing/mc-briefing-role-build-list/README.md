# Briefing role-building list

`<mc-briefing-role-build-list>`

Role-building card list: a "Recommended for you" group and then every other card as a grid of pictures with name, cost and aspect, and a Take button each. A tap on a picture or its name reads the card in Inspect, which offers "Take this card".

## Usage

```html
<mc-briefing-role-build-list></mc-briefing-role-build-list>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `model` | property | `RoleBuildListModel`. |

## Events

- `mc-briefing-step`: `{ type: "take", id }`.
- `mc-briefing`: an `inspect` with a `choice`.

## Files

- `McBriefingRoleBuildList.ts`: the class
- `mc-briefing-role-build-list.ts`: the define file (registers the element once)
- `mc-briefing-role-build-list.styles.ts`: the constructible stylesheet
- `mc-briefing-role-build-list.types.ts`: the property and event types
- `__tests__/`: the tests
