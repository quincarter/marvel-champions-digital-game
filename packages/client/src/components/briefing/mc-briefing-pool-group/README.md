# Briefing pool group

`<mc-briefing-pool-group>`

The finale groups of "From the pool", one per destination. On a phone a thin header bar over the flat rows; on a wide column a boxed header (title and caption) over small picture tiles with the card name and its ALLY / ENEMY / HELPS / AGAINST word under each.

## Usage

```html
<mc-briefing-pool-group></mc-briefing-pool-group>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `group` | property | `PoolGroupModel`. |
| `phone` | attribute | The stacked form. |

## Events

- `mc-briefing`: `{ type: "inspect", cardId, name }`.

## Files

- `McBriefingPoolGroup.ts`: the class
- `mc-briefing-pool-group.ts`: the define file (registers the element once)
- `mc-briefing-pool-group.styles.ts`: the constructible stylesheet
- `mc-briefing-pool-group.types.ts`: the property and event types
- `__tests__/`: the tests
