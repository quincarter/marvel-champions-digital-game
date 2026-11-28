# mc-aspect-segment

One aspect of the rail (green when the deck uses it) with an "i" that opens its tip.

Properties are declared in `mc-aspect-segment.types.ts`; the element holds no game state and computes nothing. Events: `mc-deck-check` `{ type: "tip", aspect }`.

Registered by its parent (`import "../mc-aspect-segment/mc-aspect-segment"`), once. Tests: `__tests__/`.
