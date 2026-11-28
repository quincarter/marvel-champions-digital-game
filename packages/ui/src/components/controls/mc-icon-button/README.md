# mc-icon-button

A chrome icon button: ink with a paper rim, a picture and optional short words (the language code beside the globe).

## Usage

```ts
html`<mc-icon-button
  icon="globe"
  label="ES"
  name="Language"
  data-stop="chrome:language"
  .action=${"language"}
></mc-icon-button>`;
```

Size it with `--icon-button-size` (44px) and, for a wide one, `--icon-button-width`. A tap is a press and release on it with
nothing scrolled between (`shared/tap.ts`). The focus route presses it through `click()`.

## Properties

| Name        | Type                                                | Meaning                                |
| ----------- | --------------------------------------------------- | -------------------------------------- |
| `icon`      | `globe` `bug` `note` `moon` `sun` `store` `discord` | The picture.                           |
| `label`     | string                                              | Short words beside the picture.        |
| `name`      | string                                              | Assistive text and tooltip.            |
| `lit`       | boolean                                             | Drawn as hovered (its pop-up is open). |
| `badge`     | string                                              | A count hung on the top right corner.  |
| `glyph`     | `ControlGlyph` (property)                           | The press glyph hung under it.         |
| `disabled`  | boolean                                             | A press does nothing.                  |
| `data-stop` | string                                              | Its focus stop's key.                  |
| `action`    | unknown (property)                                  | What a tap raises.                     |

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`.

## Slots

None.
