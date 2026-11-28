# mc-pack-grid

The store's packs as a native scrolling CSS grid of `mc-pack-tile`s. Where it was scrolled to is kept by `listId`; `scrollFrom` going up sends it to the top.

Properties are declared in `mc-pack-grid.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-pack-grid/mc-pack-grid.js"`), once. Tests: `__tests__/`.
