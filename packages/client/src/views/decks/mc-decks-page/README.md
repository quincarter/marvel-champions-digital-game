# mc-decks-page

The Decks & Collection page. It composes the sections and holds no state: the shared `mc-top-bar`, then either three panes side by side
(`mc-decks-list`, `mc-decks-cards`, the ink `mc-decks-stats`) or, narrow, one pane at a time behind an `mc-tab-rail`
(Decks / Cards / Stats). The scene (`scenes/decks.ts`) mounts it with `mountElement`, sets `model` from its view models and
handles the typed `mc-decks` events (`components/decks/decks.types.ts`).

| Property | Type                                                 |
| -------- | ---------------------------------------------------- |
| `model`  | `DecksPageModel` (`components/decks/decks.types.ts`) |

| Event      | Detail                                                           |
| ---------- | ---------------------------------------------------------------- |
| `mc-decks` | every section's event, and the tab rail's `{ type: "tab", tab }` |

`section(tag)` finds a section by its tag (the scene reads the list's scroller, the grid and the search fields from them).
Layout is CSS; `model.wide` only picks the arrangement.

Focus stops: those of the sections (see `decks.types.ts`), and `tab:decks`, `tab:cards`, `tab:stats` on the narrow rail.
