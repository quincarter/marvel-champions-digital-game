# mc-track-list

The earned songs, scrolling natively; the scroll position stays across a redraw.

Used by `mc-music-player`.

## Markup

```html
<mc-track-list></mc-track-list>
```

## Properties

| Property | Type            | Notes |
| -------- | --------------- | ----- |
| `model`  | `TrackListModel | null` | tracks, empty |

## Events

- `mc-activate` (bubbles, composed): `{ key }`: `song:<id>`

## Made of

- `mc-track-row`

## Files

`mc-track-list.ts` defines the element (guarded), `McTrackList.ts` is the class, `mc-track-list.styles.ts` its `css`, `mc-track-list.types.ts` the model and event types.
