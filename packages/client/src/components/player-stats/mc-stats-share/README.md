# mc-stats-share

Share my games and the line saying what is sent, or Sharing on.

## Usage

```ts
html`<mc-stats-share .input=${{ kind: "on", label: "Sharing on" }}></mc-stats-share>`;
```

## Properties

| Name    | Type                       | Meaning      |
| ------- | -------------------------- | ------------ |
| `input` | StatsShareInput (property) | Offer or on. |

## Events

`mc-player-stats` (bubbles, composed): `StatsEventDetail`. `{ type: "share" }`.

## Slots

None.
