# mc-track-row

One song: a disc, the title and where it plays.

Used by `mc-track-list`.

## Markup

```html
<mc-track-row></mc-track-row>
```

## Properties

| Property | Type           | Notes |
| -------- | -------------- | ----- |
| `model`  | `TrackRowModel | null` | key, title, where, playing |

## Events

- `mc-activate` (bubbles, composed): `{ key }` on a tap (the tap rule)

## Files

`mc-track-row.ts` defines the element (guarded), `McTrackRow.ts` is the class, `mc-track-row.styles.ts` its `css`, `mc-track-row.types.ts` the model and event types.
