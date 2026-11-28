# mc-stats-chip-row

A row of chips: filters, Matchups views and toggles, Hide hero cards. Each chip is a focus stop that says its press as one event.

## Usage

```ts
html`<mc-stats-chip-row .chips=${chips} ?swipe=${phone}></mc-stats-chip-row>`;
```

## Properties

| Name    | Type                        | Meaning                              |
| ------- | --------------------------- | ------------------------------------ |
| `chips` | StatsChipModel[] (property) | Key, label, selected, action, glyph. |
| `swipe` | boolean                     | One swiping row (a phone's).         |

## Events

`mc-player-stats` (bubbles, composed): `StatsEventDetail`.

## Slots

None.
