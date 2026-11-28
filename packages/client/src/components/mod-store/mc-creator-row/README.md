# mc-creator-row

One creator of the Credits tab as a press control: a red bar, their name, how many packs and which. Events: `mc-mod-store` `{ type: "creator", name }`.

Properties are declared in `mc-creator-row.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-creator-row/mc-creator-row.js"`), once. Tests: `__tests__/`.
