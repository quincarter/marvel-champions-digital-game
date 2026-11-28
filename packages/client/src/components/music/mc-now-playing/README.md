# mc-now-playing

The ink strip at the head of the music player: a note, the status in caution yellow, the song and what plays it. Music-only,
so it lives with the client. It holds no state and takes no press.

Used by `mc-music-player`.

## Markup

```html
<mc-now-playing status="NOW PLAYING" song="Main Title" detail="Repeating this song"></mc-now-playing>
```

## Properties

| Property | Type             | Notes                                              |
| -------- | ---------------- | -------------------------------------------------- |
| `status` | `string`         | the words over the song                            |
| `song`   | `string \| null` | the song; `null` while nothing plays (sets `idle`) |
| `detail` | `string \| null` | what plays it                                      |
| `idle`   | `boolean`        | reflected from `song`: the note dims               |

## Events

None.

## Files

`mc-now-playing.ts` defines the element (guarded), `McNowPlaying.ts` is the class, `mc-now-playing.styles.ts` its `css`,
`mc-now-playing.types.ts` the property types. Tests: `__tests__/`.
