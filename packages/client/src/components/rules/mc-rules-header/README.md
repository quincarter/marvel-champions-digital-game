# mc-rules-header

The ink chrome band: Back (an `mc-hint-button`, so it carries the Cancel glyph on a keyboard or pad), the title, and under them the scope row (`mc-rules-scope`, which this element registers and composes). Back is the focus stop `back`.

## Properties

| Name         | Type          | Meaning                         |
| ------------ | ------------- | ------------------------------- |
| `back-label` | string        | "◂ Back".                       |
| `heading`    | string        | "Rules reference".              |
| `backGlyph`  | `HintGlyph`   | The Cancel glyph, or null.      |
| `caption`    | string        | The scope row's words.          |
| `toggle`     | object / null | The scope toggle (with a game). |

## Events

`mc-rules` `{ type: "back" }`, and the scope row's `scope`.
