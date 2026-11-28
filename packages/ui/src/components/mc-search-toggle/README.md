# Search toggle

`<mc-search-toggle>`

A square button with a magnifier that shows or hides a search field (a phone's roster gets the row back). On while the
field is shown or holds text. A tap raises `mc-press`; so does a focus stop's `click()`.

## Usage

```html
<mc-search-toggle></mc-search-toggle>
```

## Properties

| Name       | Kind      | What it is                               |
| ---------- | --------- | ---------------------------------------- |
| `label`    | attribute | The accessible name, already translated. |
| `selected` | attribute | The field is shown or filled.            |

## Events

- `mc-press`: A tap on the button (from the inner `mc-button`).

## Files

- `McSearchToggle.ts`: the class
- `mc-search-toggle.ts`: the define file (registers the element once)
- `mc-search-toggle.styles.ts`: the constructible stylesheet
- `mc-search-toggle.types.ts`: the property and event types
- `__tests__/`: the tests
