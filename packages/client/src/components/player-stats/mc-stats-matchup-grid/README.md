# mc-stats-matchup-grid

The Matchups heat and stamp grids in a native scroll container with pinned names. One focus stop, grid:cell, whose arrows move the cursor.

## Usage

```ts
html`<mc-stats-matchup-grid .grid=${grid} .cursor=${cursor}></mc-stats-matchup-grid>`;
```

## Properties

| Name     | Type                       | Meaning                       |
| -------- | -------------------------- | ----------------------------- |
| `grid`   | StatsGridModel (property)  | The grid.                     |
| `cursor` | StatsGridCursor (property) | The pairing the cursor is on. |
| `mode`   | wide                       | phone                         | Cell sizes. |

## Events

`mc-player-stats` (bubbles, composed): `StatsEventDetail`. `{ type: "grid-cursor", row, column }`.

## Slots

None.
