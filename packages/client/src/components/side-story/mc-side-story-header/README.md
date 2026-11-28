# mc-side-story-header

The ink head of the side-story reader: "SIDE STORY", the title, the credit, and CLOSE (an `mc-hint-button`, so it carries the Start glyph on a keyboard or pad). CLOSE is the focus stop `close`.

## Properties

| Name          | Type        | Meaning                         |
| ------------- | ----------- | ------------------------------- |
| `label`       | string      | "SIDE STORY".                   |
| `title`       | string      | The story's title, in capitals. |
| `credit`      | string      | The credit line.                |
| `close-label` | string      | "CLOSE ✕".                      |
| `closeGlyph`  | `HintGlyph` | The Start glyph, or null.       |
| `compact`     | boolean     | A phone's smaller sizes.        |

## Events

`mc-side-story` `{ type: "close" }`.
