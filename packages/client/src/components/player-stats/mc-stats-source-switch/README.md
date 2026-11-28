# mc-stats-source-switch

The You / Everyone pair in the ink bar; the chosen segment is filled.

## Usage

```ts
html`<mc-stats-source-switch source="you" you-label="You" everyone-label="Everyone"></mc-stats-source-switch>`;
```

## Properties

| Name                         | Type                    | Meaning                              |
| ---------------------------- | ----------------------- | ------------------------------------ |
| `source`                     | you                     | everyone                             | Whose numbers are on show. |
| `you-label / everyone-label` | string                  | The segments' words.                 |
| `glyph`                      | ControlGlyph (property) | The glyph on the segment not chosen. |
| `compact`                    | boolean                 | Narrow segments (a phone).           |

## Events

`mc-player-stats` (bubbles, composed): `StatsEventDetail`. `{ type: "source", source }`.

## Slots

None.
