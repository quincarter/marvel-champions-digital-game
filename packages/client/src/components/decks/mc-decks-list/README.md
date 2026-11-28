# mc-decks-list

The "Your decks" section of Decks & Collection: the heading with "+ New deck", the status banner, the search and filters
(`mc-decks-list-filters`), the deck rows (`mc-deck-row`, listing look, one native scroller) and the Import / Export box
(`mc-decks-import-box`) pinned under them.

| Property | Type                                |
| -------- | ----------------------------------- |
| `model`  | `DecksListModel` (`decks.types.ts`) |

| Event      | Detail                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mc-decks` | `{ type: "deck", deckId, via: "press" \| "inspect" }`, `{ type: "action", action: "new-deck" }`, and the children's events |

`scroller` is the rows' scroll container. `model.reveal` scrolls a deck into view once per `key`; a changed `model.topKey`
scrolls to the top. A row's picture raises the card events (`mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect`) and
`mc-image-error`.

Focus stops: `new-deck`, `deck:<deck id>`, and the children's (`deck-search`, `filters-toggle`, `deck-chip:<id>`, the
import box's).
