# mc-stats-card

A card the stats name: its picture and what you did with it. A tap does nothing; a hold, Inspect and Enter open the card.

## Usage

```ts
html`<mc-stats-card .card=${card}></mc-stats-card>`;
```

## Properties

| Name   | Type                      | Meaning   |
| ------ | ------------------------- | --------- |
| `card` | StatsCardModel (property) | The card. |

## Events

`mc-pressed`: a hold or Inspect, `{ type: "card", cardId }`.

## Slots

None.
