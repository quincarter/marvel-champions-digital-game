# mc-music-player

The Music player pop-up: a popover hanging from the music button, or on a phone a panel filling the screen under the top
bar. It composes `mc-now-playing`, `mc-player-controls` (with the `mc-volume-slider` slotted beside Pause on a desktop
form factor) and `mc-track-list`, and holds no state.

Mounted by `scenes/music-player.ts` (`mountElement`), which sets `model` and hears `mc-music`. All layout is CSS: the
popover's width, its clamp inside the screen and its height (the list scrolls past the screen's limit) come from the
`anchor` the scene hands in; nothing is computed in JS.

## Markup

```html
<mc-music-player></mc-music-player>
```

## Properties

| Property | Type                       | Notes                                                                                      |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| `model`  | `MusicPlayerModel \| null` | phone, anchor, title, earned, closeLabel, nowPlaying, controls, volume, list, foot, glyphs |
| `phone`  | `boolean`                  | reflected from `model.phone`                                                               |

`scroller` and `volumeTrack` (getters): the list's scrolling element and the slider's track, for the stick and the e2e hook.

## Events

One event, `mc-music` (bubbles, composed), with a `MusicEventDetail`:

- `{ type: "press", key }`: `close`, `shuffle`, `next`, `pause`, `song:<id>`, or `outside` (a tap beside the panel)
- `{ type: "slide", share, commit }`: the volume track pressed or dragged
- `{ type: "step", direction }`: the volume minus or plus

The scene's region holds `mc-music` back while it is not taking input (`GUARDED_EVENTS`).

## Made of

- `mc-now-playing`, `mc-player-controls`, `mc-track-list` (`components/music/`)
- `mc-volume-slider`, `mc-track-row`, `mc-button`, `mc-glyph-hint` (`@mc/ui`)

## Files

`mc-music-player.ts` defines the element (guarded), `McMusicPlayer.ts` is the class, `mc-music-player.styles.ts` its
`css`, `mc-music-player.types.ts` the model. Tests: `__tests__/`.
