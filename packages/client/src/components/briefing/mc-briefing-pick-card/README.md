# Briefing pick card

`<mc-briefing-pick-card>`

One card an option is about (the scheme, the environment it earns, the encounter card it brings, or the card an option is): its picture, with what the card is to the option and its name beside the picture when there is room and under it when there is not. A tap or hold on the picture opens the card in Inspect.

## Usage

```html
<mc-briefing-pick-card></mc-briefing-pick-card>
```

## Properties

| Name    | Kind      | What it is                  |
| ------- | --------- | --------------------------- |
| `card`  | property  | `PickCardModel`.            |
| `stop`  | attribute | The picture focus stop key. |
| `badge` | attribute | The magnifier badge.        |

## Events

- `mc-briefing`: `{ type: "inspect", cardId, name }`.

## Files

- `McBriefingPickCard.ts`: the class
- `mc-briefing-pick-card.ts`: the define file (registers the element once)
- `mc-briefing-pick-card.styles.ts`: the constructible stylesheet
- `mc-briefing-pick-card.types.ts`: the property and event types
- `__tests__/`: the tests
