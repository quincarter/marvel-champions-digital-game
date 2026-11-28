# mc-pack-actions

The buttons a pack's state offers (Install, Update, Remove, confirm, cancel); an unavailable one stays dimmed and says why. Events: `mc-mod-store` `{ type: "pack-action", action }`.

Properties are declared in `mc-pack-actions.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-pack-actions/mc-pack-actions.js"`), once. Tests: `__tests__/`.
