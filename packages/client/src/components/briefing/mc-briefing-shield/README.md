# Briefing case file

`<mc-briefing-shield>`

The case file (Agents of S.H.I.E.L.D., MC50 pp. 5, 6 and 24): the evidence the players hold as pictures, how many combinations are still open, the Executive Board secrets, the numbers the next Setups read and, in an expert campaign, each seat hit points. It never reads the sealed A.I.M. envelope.

## Usage

```html
<mc-briefing-shield></mc-briefing-shield>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `model` | property | `ShieldSectionModel`. |

## Events

- `mc-briefing`: `{ type: "inspect", cardId, name }`.

## Files

- `McBriefingShield.ts`: the class
- `mc-briefing-shield.ts`: the define file (registers the element once)
- `mc-briefing-shield.styles.ts`: the constructible stylesheet
- `mc-briefing-shield.types.ts`: the property and event types
- `__tests__/`: the tests
