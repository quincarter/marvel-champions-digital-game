# mc-copy-buttons

A card - copies in the deck and +. A button that cannot be pressed stays in place, dimmed, with the reason as its tooltip. The scene checks again when it hears the press; this element never decides what is legal.

```html
<mc-copy-buttons></mc-copy-buttons>
```

| Property  | Type             | Notes                                          |
| --------- | ---------------- | ---------------------------------------------- |
| model     | CopyButtonsModel | cardId, minus, plus                            |
| quantity  | number           | copies in the deck                             |
| qty-first | boolean          | the count sits before the buttons (a list row) |

| Event           | Detail                  |
| --------------- | ----------------------- |
| mc-deck-builder | add / remove { cardId } |

Uses: mc-button (@mc/ui)

The parent imports `mc-copy-buttons/mc-copy-buttons` once; shared `@mc/ui` elements are defined by the ui entry.
