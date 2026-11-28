# mc-tip-chip

A filter chip with an optional second segment, a button of its own (the aspect chips' "i") that opens a tip about the chip
instead of filtering by it. The body is an `mc-filter-chip` (chosen reads "✓ name", unchosen "name 3" with its count); the
segment is an `mc-button` labelled "i", chosen while its tip is open. Pressed by a tap only (`shared/tap.ts`).

```html
<mc-tip-chip
  label="Justice"
  value="aspect:justice"
  stop="hero-chip:aspect:justice"
  info-label="About Justice"
  info-stop="hero-chip-info:justice"
  .tint=${{ fill: "#f5c518", ink: "#000" }}
></mc-tip-chip>
```

| Property     | Type                  | Notes                                                           |
| ------------ | --------------------- | --------------------------------------------------------------- |
| `label`      | string                | already translated                                              |
| `count`      | number                | shown while not chosen                                          |
| `selected`   | boolean               | chosen                                                          |
| `disabled`   | boolean               | dimmed, no press; `reason` is its tooltip                       |
| `mark`       | boolean               | check before a chosen name (default on)                         |
| `size`       | number                | label px (11)                                                   |
| `value`      | string                | reported as `detail.key`                                        |
| `info-label` | string                | the "i" segment's accessible name; no segment while empty       |
| `info-open`  | boolean               | the "i" is chosen                                               |
| `stop`       | string                | `data-stop` of the body                                         |
| `info-stop`  | string                | `data-stop` of the "i"                                          |
| `tint`       | `{ fill, ink }` (CSS) | the chip's rest colors; the "i" is the same fill, a step darker |

| Event         | Detail                                               |
| ------------- | ---------------------------------------------------- |
| `mc-activate` | `{ key }` (the chip's `value`): the body was pressed |
| `mc-info`     | `{ key }`: the "i" was pressed                       |

`infoElement` is the "i" segment, for a tip that points at it. `--mc-chip-height` (44px) and `--mc-chip-info-width` (44px)
size it.
