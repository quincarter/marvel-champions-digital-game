# mc-stats-row

One boxed fact: label, figure, line, a card picture, a why-you-lose bar and a View game link. One focus stop, row:<id>.

## Usage

```ts
html`<mc-stats-row data-stop="row:hero:01001a" .row=${row}></mc-stats-row>`;
```

## Properties

| Name  | Type                     | Meaning  |
| ----- | ------------------------ | -------- |
| `row` | StatsRowModel (property) | The row. |

## Events

`mc-pressed`: a tap opens its game (`open-game`); a hold or Inspect opens its card (`card`).

## Slots

None.
