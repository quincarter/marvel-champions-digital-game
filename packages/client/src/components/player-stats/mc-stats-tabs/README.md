# mc-stats-tabs

The tab row (mc-tab-rail) with LB / RB's glyphs over it; swipes where the tabs do not fit; a phone's Filters chip at its end.

## Usage

```ts
html`<mc-stats-tabs .tabs=${tabs} selected="overview"></mc-stats-tabs>`;
```

## Properties

| Name       | Type                      | Meaning                 |
| ---------- | ------------------------- | ----------------------- |
| `tabs`     | TabRailTab[] (property)   | The tabs.               |
| `selected` | string                    | The chosen tab's id.    |
| `glyph`    | ControlGlyph (property)   | LB / RB's glyphs.       |
| `toggle`   | StatsChipModel (property) | A phone's Filters chip. |

## Events

`mc-player-stats` (bubbles, composed): `StatsEventDetail`. `{ type: "tab", tab }`.

## Slots

None.
