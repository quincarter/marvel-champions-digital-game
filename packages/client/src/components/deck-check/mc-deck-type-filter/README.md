# mc-deck-type-filter

The rail's type chips that narrow the card list; a display filter only. Stops are `filter:<id>`.

Properties are declared in `mc-deck-type-filter.types.ts`; the element holds no game state and computes nothing. Events: `mc-deck-check` `{ type: "filter", filter }`.

Registered by its parent (`import "../mc-deck-type-filter/mc-deck-type-filter"`), once. Tests: `__tests__/`.
