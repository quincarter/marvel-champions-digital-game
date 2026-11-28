# mc-stats-matchup-side

The Focus view's list of every villain, scrolling natively.

## Usage

```ts
html`<mc-stats-matchup-side .rows=${rows}></mc-stats-matchup-side>`;
```

## Properties

| Name   | Type                           | Meaning       |
| ------ | ------------------------------ | ------------- |
| `rows` | StatsSideRowModel[] (property) | The villains. |

## Events

`mc-player-stats` (bubbles, composed): `StatsEventDetail`. `{ type: "focus-row", row }`.

## Slots

None.
