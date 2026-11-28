# mc-stats-aspects-donut

The Aspects tab's ring with a legend that names every aspect with its share.

## Usage

```ts
html`<mc-stats-aspects-donut chart-key="donut:aspects" .shares=${shares}></mc-stats-aspects-donut>`;
```

## Properties

| Name                  | Type                          | Meaning                                 |
| --------------------- | ----------------------------- | --------------------------------------- |
| `chart-key / caption` | string                        | The drawing's key and its centre words. |
| `shares`              | StatsAspectShare[] (property) | The aspects.                            |

## Events

None.

## Slots

None.
