# mc-decks-thumb

A card scan fitted whole in a frame, for the From your games lists and the pane's card view. A mouse over it opens the card hover
popover; a hold inspects the card (`watchCard`).

| Property  | Attribute | Type            | Notes                                  |
| --------- | --------- | --------------- | -------------------------------------- |
| `picture` | none      | `PictureSource` | the scan                               |
| `cardId`  | `card-id` | string          | the card it shows; with none, no hover |
| `missing` | `missing` | string          | said while there is no scan            |

| Event                                                   | Detail                                    |
| ------------------------------------------------------- | ----------------------------------------- |
| `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect` | see `watchCard`                           |
| `mc-image-error`                                        | `{ src, key? }` (from the tile, composed) |

The size is the host's (`width`, `height` or `aspect-ratio` from its parent).
