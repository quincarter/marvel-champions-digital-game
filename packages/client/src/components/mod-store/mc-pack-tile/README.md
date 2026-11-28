# mc-pack-tile

One pack of the grid: the pack look of `mc-media-row` (picture, name, byline, summary, size, state chip) as a press control (`McPress`). A tap, or the focus route's Enter, opens the pack. Events: `mc-mod-store` `{ type: "open-pack", id }`.

Properties are declared in `mc-pack-tile.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-pack-tile/mc-pack-tile.js"`), once. Tests: `__tests__/`.
