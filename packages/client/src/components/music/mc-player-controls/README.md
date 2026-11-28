# mc-player-controls

The controls row of the music player: Shuffle and Next side by side, Pause (Play while paused) under them, and the volume
slider slotted beside Pause on a desktop form factor. Music-only, so it lives with the client.

Used by `mc-music-player`. A press raises `mc-music` (`MusicElement`): the buttons' own `mc-press` never leaves.

## Markup

```html
<mc-player-controls shuffle-label="Shuffle: off" next-label="Next" pause-label="Pause" slider>
  <mc-volume-slider slot="volume"></mc-volume-slider>
</mc-player-controls>
```

## Properties

| Property       | Type            | Notes                                                 |
| -------------- | --------------- | ----------------------------------------------------- |
| `shuffleLabel` | `string`        | attribute `shuffle-label`                             |
| `nextLabel`    | `string`        | attribute `next-label`                                |
| `pauseLabel`   | `string`        | attribute `pause-label`                               |
| `shuffleOn`    | `boolean`       | Shuffle reads as chosen                               |
| `paused`       | `boolean`       | Pause reads as chosen                                 |
| `reason`       | `string`        | dims Shuffle and Next, says why (nothing earned yet)  |
| `withSlider`   | `boolean`       | attribute `slider`: Pause takes a fixed width         |
| `glyphs`       | `ControlGlyphs` | key or pad glyphs by key (`shuffle`, `next`, `pause`) |

## Events

- `mc-music` (bubbles, composed): `{ type: "press", key: "shuffle" | "next" | "pause" }`

## Slots

- `volume`: the `mc-volume-slider`, beside Pause.

## Files

`mc-player-controls.ts` defines the element (guarded), `McPlayerControls.ts` is the class, `mc-player-controls.styles.ts`
its `css`, `mc-player-controls.types.ts` the property types. Tests: `__tests__/`.
