# mc-dialog

A paper box with a 4px ink border over a scrim: a heading, a body that scrolls natively and a footer. A tap on the scrim raises mc-dialog-dismiss. It fills the overlay region it is mounted in.

```html
<mc-dialog></mc-dialog>
```

| Property | Type    | Notes                    |
| -------- | ------- | ------------------------ |
| heading  | string  | the title, translated    |
| width    | number  | the box widest, px (520) |
| tall     | boolean | fills the height         |

| Event             | Detail             |
| ----------------- | ------------------ |
| mc-dialog-dismiss | a tap on the scrim |

The parent imports `mc-dialog/mc-dialog` once; shared `@mc/ui` elements are defined by the ui entry.
