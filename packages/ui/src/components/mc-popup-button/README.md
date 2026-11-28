# mc-popup-button

A pop-up's button: an `mc-button` reporting its press as `mc-activate`, with a key or pad glyph hung on it while a keyboard or pad is in use. Used by the language menu, Report an issue and the Music player.

## Markup

```html
<mc-popup-button></mc-popup-button>
```

## Properties

| Property | Type                   | Notes                                                                                     |
| -------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| `button` | `PopupButton \| null`  | `key` (the focus stop, on the inner `mc-button`), `label`, `kind`, `selected`, `disabled` |
| `glyph`  | `ControlGlyph \| null` | The hung glyph; an inside glyph slides the word over by `--mc-label-shift`                |

The host fills its box (`height: 100%`); the owner sizes it.

## Events

- `mc-activate` (bubbles, composed): `{ key }` when the button is pressed.

## Files

`mc-popup-button.ts` defines the element (guarded), `McPopupButton.ts` is the class, `mc-popup-button.styles.ts` its `css`, `mc-popup-button.types.ts` the input type.
