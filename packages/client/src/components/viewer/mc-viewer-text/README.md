# mc-viewer-text

The file's words beside the picture (under it on a narrow screen): the subtitle, the lines (a quote in italics), a promo card's use-this-art control (focus stop `promo`) with what to do when promo art is off, and the note about what is still to earn. It scrolls on its own when the words are long.

## Properties

| Name       | Type           | Meaning                                       |
| ---------- | -------------- | --------------------------------------------- |
| `subtitle` | string         | The second line, or "".                       |
| `lines`    | `ViewerLine[]` | `{ text, quote }`.                            |
| `promo`    | `ViewerPromo`  | `{ label, off }` for a promo card, else null. |
| `note`     | string         | What is still to earn, or "".                 |
| `wide`     | boolean        | Beside the picture: the larger type.          |

## Events

`mc-viewer` `{ type: "promo" }`.
