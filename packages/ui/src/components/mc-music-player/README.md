# mc-music-player

The music player: a popover hanging from the music button, or on a phone a panel under the top bar.

Opened by the music button and by Pause (`scenes/music-player.ts`).

## Markup

```html
<mc-music-player></mc-music-player>
```

## Properties

| Property | Type              | Notes |
| -------- | ----------------- | ----- |
| `model`  | `MusicPlayerModel | null` | phone, panel, icon, title, earned, close, nowPlaying, controls, volume, list, foot, glyphs |

## Events

- `mc-activate` (bubbles, composed): `{ key }`: `close`, `shuffle`, `next`, `pause`, `song:<id>`, `outside`
- `mc-slide` (bubbles, composed): `{ key, share, commit }`: the volume track
- `mc-step` (bubbles, composed): `{ key, direction }`: the volume - or +

## Made of

- `mc-now-playing`
- `mc-player-controls`
- `mc-volume-slider`
- `mc-track-list`

## Files

`mc-music-player.ts` defines the element (guarded), `McMusicPlayer.ts` is the class, `mc-music-player.styles.ts` its `css`, `mc-music-player.types.ts` the model and event types.
