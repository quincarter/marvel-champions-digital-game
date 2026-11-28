# mc-pause-page

The in-game Pause screen as one page element that only composes sections: `mc-pause-header`, `mc-pause-menu`, the search field, `mc-pause-rules`, `mc-pause-log`, `mc-pause-results`, `mc-pause-quick`, `mc-pause-table` and `mc-pause-confirm` (all in `components/pause/`).

Wide: the ink panel (header over the menu column) beside the pane (the search field over the Rules reference and "Jump to a moment", the Full game log, or the search results on an ink ground). Phone: one ink sheet (header, search, a scrolling body, footer). On a short screen the ink column scrolls and compacts, so no button draws over another.

## Usage

```ts
const { region, element } = mountElement(this, "mc-pause-page", { x: 0, y: 0, width, height });
element.model = pausePageModel;
element.addEventListener("mc-pause", (event) => act(event.detail));
```

## Properties

| Name    | Type             | Meaning                                         |
| ------- | ---------------- | ----------------------------------------------- |
| `model` | `PausePageModel` | What the page shows; its `mode` picks the form. |

`searchField` (getter) is the search field; `resetScroll()` reads the body from its top.

## Events

`mc-pause` (`PauseEventDetail`), `mc-search` and `mc-search-focus` from the field, and the card hover events of a keyword card's name.

## Focus stops

`close`, the menu ids (`resume`, `full-game-log`, ...), `search`, `keyword:<id>`, `moment:<id>`, `quick-toggle`, `quick:<id>`, `table:<id>`, `guide:<id>`, `result:<id>`, `concede-confirm-yes`, `concede-confirm-cancel`.
