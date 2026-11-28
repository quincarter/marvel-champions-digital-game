# mc-builder-header

The screen title and Back. A long title wraps; the scene measures the title box and, where the dark mode toggle would sit over it, drops the row or stops the title short.

```html
<mc-builder-header></mc-builder-header>
```

| Property | Type               | Notes                              |
| -------- | ------------------ | ---------------------------------- |
| model    | BuilderHeaderModel | title, back label, back glyph      |
| layout   | wide               | narrow                             | phone | smaller title on a phone |
| drop     | number             | px the row drops                   |
| maxWidth | number             | px the title may run (0: no limit) |

| Event           | Detail         |
| --------------- | -------------- |
| mc-deck-builder | { type: back } |

Focus stops: back

Uses: mc-button, mc-glyph-hint (@mc/ui)

The parent imports `mc-builder-header/mc-builder-header` once; shared `@mc/ui` elements are defined by the ui entry.
