# mc-stats-split-tile

A fact split into parts (how you lose): a bar with each part's words.

## Usage

```ts
html`<mc-stats-split-tile label="How you lose" .parts=${parts}></mc-stats-split-tile>`;
```

## Properties

| Name             | Type                        | Meaning                                 |
| ---------------- | --------------------------- | --------------------------------------- |
| `label / detail` | string                      | The caption and the line under the bar. |
| `parts`          | SegmentBarPart[] (property) | The bar's parts.                        |

## Events

None.

## Slots

None.
