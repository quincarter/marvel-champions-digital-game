# mc-track-list

The earned songs, one `mc-track-row` each, scrolling natively; the scroll position stays across a redraw. While there are
none it says `empty` instead. Music-only, so it lives with the client.

Used by `mc-music-player`. A row's tap (`mc-pressed`) is turned into the list's own `mc-music` press and goes no further.

## Markup

```html
<mc-track-list empty="No songs earned yet."></mc-track-list>
```

## Properties

| Property | Type                       | Notes                                             |
| -------- | -------------------------- | ------------------------------------------------- |
| `tracks` | `readonly TrackListItem[]` | key (`song:<id>`), title, where, playing          |
| `empty`  | `string`                   | said in place of the list while `tracks` is empty |

`scroller` (getter): the scrolling element, for the stick and for scrolling a focused row into view.

## Events

- `mc-music` (bubbles, composed): `{ type: "press", key: "song:<id>" }`

## Made of

- `mc-track-row` (`@mc/ui`)

## Files

`mc-track-list.ts` defines the element (guarded), `McTrackList.ts` is the class, `mc-track-list.styles.ts` its `css`,
`mc-track-list.types.ts` the property types. Tests: `__tests__/`.
