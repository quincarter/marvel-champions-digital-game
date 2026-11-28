# mc-seats-page

Take your seats as one page element. It composes the sections and nothing else: `mc-seats-header`, `mc-seats-table` (seats,
Team-Up pairs, narrow summary), `mc-seats-notice`, `mc-seats-filters`, `mc-seats-roster`, `mc-seats-detail` (wide only),
`mc-seats-footer` and, over everything while `model.decks` is set, `mc-hero-decks-sheet`. Each section's define file is
imported once, here (the filters and roster defines are imported by their own views of the page's tree: see the file).
Layout is CSS grid and flex with native scrolling; `model.wide` picks the wide arrangement (the ink detail column and the
footer inside it) or the narrow one (one column, sticky ink footer).

The scene mounts it with `mountElement`, sets `model` from its view model and draft, and handles the `mc-seats` events that
bubble out of every section (`SeatsEvent`, `components/seats/seats.types.ts`).

| Property | Type                                    | Notes                               |
| -------- | --------------------------------------- | ----------------------------------- |
| `model`  | `SeatsPageModel \| null`                | rebuilt by the scene on each change |
| `wide`   | `boolean` (reflected from `model.wide`) | the layout the CSS keys on          |

`section(tag)` returns a section element for the scene's reads (the roster's scroller, the filters' search field).
