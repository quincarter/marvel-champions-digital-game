# mc-track-row

One song in a list: a red disc, the title and where it plays. An ink row while it is the song playing.

Generic: it knows nothing of the music player. It sits on the `McPress` base, so a tap (never the lift that ends a swipe)
and the focus route's `click()` raise `mc-pressed` with the `action` its owner gave it.

## Markup

```html
<mc-track-row
  .stop="${'song:main'}"
  .action="${'song:main'}"
  heading="Main Title"
  where="Title screen"
  playing
></mc-track-row>
```

## Properties

| Property  | Type      | Notes                                  |
| --------- | --------- | -------------------------------------- |
| `heading` | `string`  | the title                              |
| `where`   | `string`  | where it plays                         |
| `playing` | `boolean` | ink row, note on the disc (reflected)  |
| `stop`    | `string`  | the focus stop (`data-stop` attribute) |
| `action`  | `unknown` | what a tap raises                      |

## Events

- `mc-pressed` (bubbles, composed): `{ action, hold }` (`PressDetail`, from `McPress`)

## Files

`mc-track-row.ts` defines the element (guarded), `McTrackRow.ts` is the class, `mc-track-row.styles.ts` its `css`,
`mc-track-row.types.ts` the property types. Tests: `__tests__/`.
