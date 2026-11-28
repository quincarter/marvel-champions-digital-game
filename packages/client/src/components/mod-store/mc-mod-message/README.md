# mc-mod-message

A line the store says in place of a list (loading, no packs, no match, the load failed with Try again) or, as `kind="offline"`, the ink strip that says the list is the saved copy. Events: `mc-mod-store` `{ type: "retry" }`.

Properties are declared in `mc-mod-message.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-mod-message/mc-mod-message.js"`), once. Tests: `__tests__/`.
