# mc-title-page

The Title screen as one element composed of sections: the notice bar, the logo block with its icon row, the menu, the rank
card, the footer, and on a wide screen the banner, In-progress games panel and Play online panel.

| Property    | Meaning                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `input`     | `TitlePageInput`: one input per section, already translated.            |
| `mode`      | `wide` (split screen) or `phone` (one column on ink), set by the scene. |
| `placement` | Reflected: `side`, `art` or `none`, from the Play online panel.         |

Events: `mc-title` `{ type: "press", key }` for every control (the key is its focus stop). Methods: `scroller` and
`artElement` (the scene draws the ink ground and the picture under it). The page is transparent over the art column, so the
canvas shows through there.
