# mc-mod-store-header

The ink bar over the Mod Store: Back, the title with its BETA tag, how many packs are installed and About mods (a `!` on a phone). Back and About carry their pad or keyboard glyph (`mc-glyph-hint`) while one is in use. Events: `mc-mod-store` `{ type: "back" }` and `{ type: "about" }`.

Properties are declared in `mc-mod-store-header.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-mod-store-header/mc-mod-store-header.js"`), once. Tests: `__tests__/`.
