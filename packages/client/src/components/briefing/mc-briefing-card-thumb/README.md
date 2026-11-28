# Briefing card thumb

`<mc-briefing-card-thumb>`

A card as a picture a row or a tile shows: the scan on a parchment ground (a word in its place while it loads or when there is none), an ink frame and an optional magnifier badge. A tap or a hold opens the card in Inspect and answers nothing; on desktop the mouse over it raises the card hover popover. Size it with `--thumb-width` or `--thumb-height`.

## Usage

```html
<mc-briefing-card-thumb></mc-briefing-card-thumb>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `picture` | property | `PictureSource`. |
| `card` | property | `{ cardId, name }` it opens; none for a plain frame. |
| `shape` | attribute | `portrait` (default) | `landscape` | `square`. |
| `badge` | attribute | Draw the magnifier badge. |
| `stop` | attribute | The focus stop key. |

## Events

- `mc-pressed`: an `inspect` action (tap and hold).
- `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect`: from `watchCard`.

## Files

- `McBriefingCardThumb.ts`: the class
- `mc-briefing-card-thumb.ts`: the define file (registers the element once)
- `mc-briefing-card-thumb.styles.ts`: the constructible stylesheet
- `mc-briefing-card-thumb.types.ts`: the property and event types
- `__tests__/`: the tests
