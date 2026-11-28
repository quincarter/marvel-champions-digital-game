# mc-stats-header

The ink bar over Your stats: Back, the title, games played, the You / Everyone switch.

## Usage

```ts
html`<mc-stats-header .input=${input} mode="wide"></mc-stats-header>`;
```

## Properties

| Name    | Type                        | Meaning            |
| ------- | --------------------------- | ------------------ |
| `input` | StatsHeaderInput (property) | What the bar says. |
| `mode`  | wide                        | phone              | Layout. |

## Events

`mc-player-stats` (bubbles, composed): `StatsEventDetail`. `{ type: "back" }`; the switch's event passes through.

## Slots

None.
