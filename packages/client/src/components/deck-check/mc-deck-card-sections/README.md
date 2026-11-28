# mc-deck-card-sections

The deck's cards as a natively scrolling `mc-card-sections`, its columns and tile sizes read from its own width.

Properties are declared in `mc-deck-card-sections.types.ts`; the element holds no game state and computes nothing. Events: `mc-deck-check` `{ type: "card", key }`; `mc-card-hover` / `mc-card-inspect` from the pictures.

Registered by its parent (`import "../mc-deck-card-sections/mc-deck-card-sections"`), once. Tests: `__tests__/`.
