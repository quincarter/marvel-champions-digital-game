# mc-chart-bar

One column of a bar chart (`mc-bar-chart` lays them out). The bar is `count / max` of the room above its label, never under 2px.

| Property    | Attribute   | Type    | Meaning                             |
| ----------- | ----------- | ------- | ----------------------------------- |
| `label`     | `label`     | string  | Under the bar                       |
| `count`     | `count`     | number  | The bar's value                     |
| `max`       | `max`       | number  | The chart's largest value           |
| `highlight` | `highlight` | boolean | Red instead of ink                  |
| `tint`      | `tint`      | string  | A CSS colour in place of ink or red |

CSS: `--chart-height` (the whole chart's height, labels included) is read from an ancestor. No events.
