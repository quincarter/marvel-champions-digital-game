# mc-segment-bar

A stacked bar: each part as wide as its share of the whole, in its own colour, framed in ink. A part can carry its words so a share is never told by colour alone.

## Usage

```ts
html`<mc-segment-bar
  .parts=${[{ count: 3, color: "#c62828", label: "Scheme 3" }]}
  labels
  height="28"
></mc-segment-bar>`;
```

## Properties

| Name     | Type                        | Meaning                                                                              |
| -------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `parts`  | SegmentBarPart[] (property) | Count, colour, optional label and ink for each part.                                 |
| `total`  | number                      | What the whole bar stands for when more than the parts add up to; 0 means their sum. |
| `height` | number                      | The bar's height in px (12).                                                         |
| `labels` | boolean                     | Writes each part's label inside it.                                                  |

## Events

None.

## Slots

None.
