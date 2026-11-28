# mc-windowed-list

A native scroller as tall as every row of which only the rows near the viewport are built: a list or grid of thousands of items costs what a screen of them does. rectOfIndex says where any item is (built or not) and scrollToIndex brings it into view.

```html
<mc-windowed-list></mc-windowed-list>
```

| Property   | Type                      | Notes                              |
| ---------- | ------------------------- | ---------------------------------- |
| count      | number                    | items                              |
| row-height | number                    | px                                 |
| columns    | number                    | items per row (1)                  |
| column-gap | number                    | px                                 |
| renderItem | (index) => TemplateResult | asked only for items in the window |

| Event     | Detail                            |
| --------- | --------------------------------- |
| mc-window | { start, end } rows built changed |

The parent imports `mc-windowed-list/mc-windowed-list` once; shared `@mc/ui` elements are defined by the ui entry.
