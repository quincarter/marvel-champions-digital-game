# mc-deck-list-panel

The wide layout's ink panel: title, sort button, the deck by group (`mc-line-list`), and an `actions` slot.

Properties are declared in `mc-deck-list-panel.types.ts`; the element holds no game state and computes nothing. Events: `mc-deck-check` `{ type: "sort" }`.

Registered by its parent (`import "../mc-deck-list-panel/mc-deck-list-panel"`), once. Tests: `__tests__/`.
