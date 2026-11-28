# mc-pack-gallery

A pack's cards in groups, each a heading and a CSS grid of `mc-pack-card`s, with a count line; native scrolling, the place kept by `listId`.

Properties are declared in `mc-pack-gallery.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-pack-gallery/mc-pack-gallery.js"`), once. Tests: `__tests__/`.
