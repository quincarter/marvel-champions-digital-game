# mc-volume-slider

A - button, a draggable track, a + button and the percent.

Used by `mc-music-player`.

## Markup

```html
<mc-volume-slider></mc-volume-slider>
```

## Properties

| Property     | Type               | Notes                                         |
| ------------ | ------------------ | --------------------------------------------- |
| `value`      | `number`           | 0 to 100                                      |
| `label`      | `string`           | the percent as read                           |
| `stepLabels` | `[string, string]` | for the buttons                               |
| `down-stop`  | `string`           | the - button's focus stop key (`volume-down`) |
| `up-stop`    | `string`           | the + button's focus stop key (`volume-up`)   |

A `heading` makes it a settings row: the title and `detail`, then a line with the `preview` slot beside the slider (`dimmed` fades it, still adjustable).

## Events

- `mc-slide` (bubbles, composed): `{ key, share, commit }`
- `mc-step` (bubbles, composed): `{ key, direction }`

## Files

`mc-volume-slider.ts` defines the element (guarded), `McVolumeSlider.ts` is the class, `mc-volume-slider.styles.ts` its `css`, `mc-volume-slider.types.ts` the model and event types.
