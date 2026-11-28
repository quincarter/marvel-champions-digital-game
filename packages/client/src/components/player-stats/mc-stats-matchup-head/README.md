# mc-stats-matchup-head

A row's or column's name on the Matchups grid, with its picture on the stamp grid.

## Usage

```ts
html`<mc-stats-matchup-head axis="row" kind="stamps" .entry=${entry}></mc-stats-matchup-head>`;
```

## Properties

| Name     | Type                          | Meaning                              |
| -------- | ----------------------------- | ------------------------------------ |
| `axis`   | row                           | column                               | Which axis. |
| `kind`   | heat                          | stamps                               | Which grid. |
| `entry`  | StatsGridAxisModel (property) | Name, picture, card.                 |
| `cursor` | boolean                       | The cursor is in this row or column. |

## Events

None.

## Slots

None.
