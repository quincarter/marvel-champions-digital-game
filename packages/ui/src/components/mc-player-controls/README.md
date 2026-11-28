# mc-player-controls

Shuffle, Next and Pause, with the volume slider slotted beside Pause.

Used by `mc-music-player`; the `volume` slot takes an `mc-volume-slider`.

## Markup

```html
<mc-player-controls></mc-player-controls>
```

## Properties

| Property | Type                 | Notes |
| -------- | -------------------- | ----- |
| `model`  | `PlayerControlsModel | null` | shuffle, next, pause, withSlider, glyphs |

## Events

- `mc-activate` (bubbles, composed): `{ key }`: `shuffle`, `next` or `pause`

## Files

`mc-player-controls.ts` defines the element (guarded), `McPlayerControls.ts` is the class, `mc-player-controls.styles.ts` its `css`, `mc-player-controls.types.ts` the model and event types.
