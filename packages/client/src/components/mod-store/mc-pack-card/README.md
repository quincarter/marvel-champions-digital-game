# mc-pack-card

One card of a pack's gallery as a press control: its picture over a name and type line. A tap, Enter or Inspect reads it in Inspect; the picture raises the card hover and Inspect events (`watchCard`). Events: `mc-mod-store` `{ type: "card", key }`.

Properties are declared in `mc-pack-card.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-pack-card/mc-pack-card.js"`), once. Tests: `__tests__/`.
