# mc-extras-shelf

One tab's tiles in a natively scrolling grid: a picture card (`mc-picture-card`, `@mc/ui`) each, with a status chip, the title and a detail line. A locked tile shows its picture as a gray ghost with LOCKED and what opens it. Every tile is a focus stop, `tile:<id>`. A promo tile also names its card (`cardId`), so the mouse over it raises the card hover events.

## Properties

| Name    | Type                                    | Meaning                                        |
| ------- | --------------------------------------- | ---------------------------------------------- |
| `tiles` | `ExtrasTile[]`                          | `{ id, card, cardId?, promoSetId? }` per tile. |
| `shape` | `"landscape"` / `"portrait"` / `"card"` | The picture's proportions.                     |
| `empty` | string                                  | What it says with none.                        |

## Events

`mc-extras` `{ type: "tile", id }`; `mc-image-error` from a picture passes through. `scroller` gives the grid's scrolling element.
