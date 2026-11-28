# mc-deck-actions

Edit deck and Start game (dimmed with its reason when no setup flow continues from here); `layout` is stack or row.

Properties are declared in `mc-deck-actions.types.ts`; the element holds no game state and computes nothing. Events: `mc-deck-check` `{ type: "edit" }` and `{ type: "start" }`.

Registered by its parent (`import "../mc-deck-actions/mc-deck-actions"`), once. Tests: `__tests__/`.
