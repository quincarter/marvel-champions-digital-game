# mc-controller-diagram

The Controls screen controller drawing: shapes and labels as one inline SVG scaled to its width (labels stay text, never under 8px), with each button picture as an `mc-glyph` laid over its label box.

| Property  | Type                | Meaning                                                           |
| --------- | ------------------- | ----------------------------------------------------------------- |
| `diagram` | `ControllerDiagram` | The ops, the glyphs and the viewBox (view/controller-diagram.ts). |

Needs `@mc/ui` defined.
