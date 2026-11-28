# mc-past-games-page

Past games as one page element. It composes sections and nothing else: `mc-top-bar` (Back, the title, and
`mc-past-games-file-button` in its `end` slot), `mc-past-games-filters`, `mc-past-games-search`, `mc-past-games-list` and
`mc-past-game-details` (a side panel beside the list, or a phone's popup over everything), and an `mc-toast` for the
status note. Layout is CSS flex with native scrolling; `model.side` and `model.phone` (the scene's form factor) pick the
arrangement.

The scene mounts it with `mountElement`, sets `model` (`PastGamesPageModel`) and handles `mc-past-games`
(`PastGamesEventDetail`, `components/past-games/shared/`), the search field's `mc-search` / `mc-search-focus`, a stale
picture's `mc-image-error` and the card events (`CardEvents`).

| Property | Type                                   | Notes                               |
| -------- | -------------------------------------- | ----------------------------------- |
| `model`  | `PastGamesPageModel \| null`           | rebuilt by the scene on each change |
| `side`   | boolean (reflected from `model.side`)  | the layout the CSS keys on          |
| `phone`  | boolean (reflected from `model.phone`) | the bar's height and the gutters    |

`listScroller`, `detailsScroller`, `searchField` and `centerRow(id)` are for the scene's reads.
