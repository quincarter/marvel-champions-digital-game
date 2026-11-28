# mc-donut-chart

A ring of arcs, each as long as its share, in its own colour, edged in ink, with words in the hole. A drawing, not a control: write the shares beside it too.

## Usage

```ts
html`<mc-donut-chart
  chart-key="donut:aspects"
  center="Aspects"
  .slices=${[{ value: 2, color: "#c62828" }]}
></mc-donut-chart>`;
```

## Properties

| Name        | Type                    | Meaning                                |
| ----------- | ----------------------- | -------------------------------------- |
| `slices`    | DonutSlice[] (property) | Value and colour of each arc.          |
| `size`      | number                  | Outer diameter in px (156).            |
| `thickness` | number                  | Ring thickness in px (32).             |
| `center`    | string                  | Words in the hole, already translated. |
| `chart-key` | string                  | The drawing's data-key.                |

## Events

None.

## Slots

None.
