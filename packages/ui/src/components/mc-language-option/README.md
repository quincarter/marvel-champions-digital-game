# mc-language-option

One row of the card language list: the language's name as a button, the current one marked. Used by `mc-language-menu`.

## Markup

```html
<mc-language-option></mc-language-option>
```

## Properties

| Property | Type                     | Notes                                               |
| -------- | ------------------------ | --------------------------------------------------- |
| `option` | `LanguageOption \| null` | `key` (the focus stop), `label`, `kind`, `selected` |

## Events

- `mc-activate` (bubbles, composed): `{ key }` when the option is pressed.

## Files

`mc-language-option.ts` defines the element (guarded), `McLanguageOption.ts` is the class, `mc-language-option.styles.ts` its `css`, `mc-language-option.types.ts` the type.
