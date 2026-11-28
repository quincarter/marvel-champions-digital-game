# Briefing pool row

`<mc-briefing-pool-row>`

One flat row of "From the pool": a stripe (green when the card helps, red when it is against the team), the card picture, its name, where this issue setup puts it, and a check or a cross at the right, so helps and against never read by colour alone. A tap or hold on the picture reads the card in Inspect.

## Usage

```html
<mc-briefing-pool-row></mc-briefing-pool-row>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `row` | property | `PoolRowModel`. |

## Events

- `mc-briefing`: `{ type: "inspect", cardId, name }`.

## Files

- `McBriefingPoolRow.ts`: the class
- `mc-briefing-pool-row.ts`: the define file (registers the element once)
- `mc-briefing-pool-row.styles.ts`: the constructible stylesheet
- `mc-briefing-pool-row.types.ts`: the property and event types
- `__tests__/`: the tests
