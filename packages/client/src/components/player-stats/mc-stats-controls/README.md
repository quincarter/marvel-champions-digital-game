# mc-stats-controls

What sits between the tabs and the stats: chip rows, steppers and the share line, stacked.

## Usage

```ts
html`<mc-stats-controls .rows=${rows}></mc-stats-controls>`;
```

## Properties

| Name   | Type                         | Meaning                       |
| ------ | ---------------------------- | ----------------------------- |
| `rows` | StatsControlRow[] (property) | Chips, stepper or share rows. |
| `mode` | wide                         | phone                         | Layout. |

## Events

`mc-player-stats` (bubbles, composed): `StatsEventDetail`.

## Slots

None.
