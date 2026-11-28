# mc-deck-list

Your deck: the Sort button, the Review button and every line by group, each with its own minus while the deck can be edited. On the wide rail it scrolls inside its own room; in the narrow Deck tab (flow) it flows.

```html
<mc-deck-list></mc-deck-list>
```

| Property | Type          | Notes                                 |
| -------- | ------------- | ------------------------------------- |
| model    | DeckListModel | label, sortLabel, reviewLabel, groups |
| flow     | boolean       | no scroller of its own                |

| Event           | Detail                                         |
| --------------- | ---------------------------------------------- |
| mc-deck-builder | deck-sort, review, and its lines: remove, open |

Focus stops: deck-sort, deck-review

Uses: mc-deck-line

The parent imports `mc-deck-list/mc-deck-list` once; shared `@mc/ui` elements are defined by the ui entry.
