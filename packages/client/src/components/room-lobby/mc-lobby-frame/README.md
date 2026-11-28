# mc-lobby-frame

A lobby panel's parchment box: an ink border, an optional Bangers heading and a body that fills the rest.

```html
<mc-lobby-frame heading="Settings"><mc-lobby-settings></mc-lobby-settings></mc-lobby-frame>
```

| Attribute  | Type      | Notes                                                 |
| ---------- | --------- | ----------------------------------------------------- |
| `heading`  | `string`  | translated; none when empty                           |
| `floating` | `boolean` | the floating chat: a heavier border and a drop shadow |

Slots: the default (content) and `end` (at the heading's right: Close, Pop out).
