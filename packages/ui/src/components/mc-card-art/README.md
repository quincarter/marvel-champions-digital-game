# mc-card-art

A card picture that says a card is here: a mouse over it raises the card hover events and a hold or right-click raises Inspect (watchCard); the client wires them to the popover and Inspect. It takes no press of its own.

```html
<mc-card-art></mc-card-art>
```

| Property | Type          | Notes                       |
| -------- | ------------- | --------------------------- |
| picture  | PictureSource | null draws the plain ground |
| card-id  | string        | empty: no hover             |
| face     | unknown       | a non-default face          |
| frame    | number        | ink frame px (2)            |
| ground   | spent         | ink                         | parchment | parchment |

| Event                                               | Detail         |
| --------------------------------------------------- | -------------- |
| mc-card-hover / mc-card-hover-end / mc-card-inspect | from watchCard |

The parent imports `mc-card-art/mc-card-art` once; shared `@mc/ui` elements are defined by the ui entry.
