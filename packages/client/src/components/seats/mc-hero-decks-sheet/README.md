# mc-hero-decks-sheet

The "Pick a deck" sheet of Take your seats: opened when a hero tile stands for several decks. A scrim over the whole
screen, a box with the header (`mc-decks-sheet-header`), a natively scrolling list of `mc-deck-row`s (`@mc/ui`) and a
Back button. It decides nothing: the scene seats the picked deck with the code a single-deck tile runs.

```html
<mc-hero-decks-sheet .model="${decksSheetModel}"></mc-hero-decks-sheet>
```

Mount it as its own region over the page (it fills its host: `position: absolute; inset: 0`), so the scrim covers the
screen and a tap outside the box closes it and presses nothing beneath. `@mc/ui` must be defined (`mc-button`,
`mc-deck-row`, `mc-picture-tile`).

| Property | Type                                         | Notes                                       |
| -------- | -------------------------------------------- | ------------------------------------------- |
| `model`  | `DecksSheetModel \| null` (`seats.types.ts`) | words arrive translated; null draws nothing |

| Event      | Detail                                                      |
| ---------- | ----------------------------------------------------------- |
| `mc-seats` | `{ type: "deck", deckId }`: a deck's Seat button            |
| `mc-seats` | `{ type: "decks-close" }`: Back, a tap on the scrim, Escape |

A disabled deck's button is dimmed with its reason as the tooltip and raises nothing.

Focus stops: `deck:<deck id>` per row (the Seat button) and `back`. The pad's B / Cancel is the scene's `onCancel`.

Card hover: a row's picture raises `mc-card-hover` / `mc-card-hover-end` / `mc-card-inspect` for `DeckRowModel.cardId`
(the hero's identity card); the scene's `CardEvents(region)` answers them.

Pictures: each `DeckRowModel.picture` is a `PictureSource`. The scene holds its `PictureLeases` (`dom/picture-leases.ts`):
`begin()`, build the models from `leases.image(source)`, `end()`, `watch(element)` on the sheet so a stale pack URL
(`mc-image-error` with a key) is read again. The events leave every shadow root (composed).

Contract additions (`DeckRowModel`): optional `status` (`ok`, `warning`, `blocked`, `locked`), `mark` (the verdict's
leading mark, translated) and `cardId`.
