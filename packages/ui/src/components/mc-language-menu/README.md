# mc-language-menu

The card language dropdown under the language button, or on a native install the "Other languages" note.

The Title and the table top bar open it from the language button (`scenes/language-popup.ts`).

## Markup

```html
<mc-language-menu></mc-language-menu>
```

## Properties

| Property | Type               | Notes |
| -------- | ------------------ | ----- |
| `model`  | `LanguageMenuModel | null` | mode (list or note), scrim, box, rowHeight, rows, note, phone |

## Events

- `mc-activate` (bubbles, composed): `{ key }`: a language, a link, `close`, or `outside` (the scrim was tapped)

## Files

`mc-language-menu.ts` defines the element (guarded), `McLanguageMenu.ts` is the class, `mc-language-menu.styles.ts` its `css`, `mc-language-menu.types.ts` the model and event types.
