# mc-mod-update-bar

The Update all bar over the grid: its words and the run's progress bar, Update all or Stop, and Show them. Events: `mc-mod-store` `{ type: "update-all", action }`.

Properties are declared in `mc-mod-update-bar.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-mod-update-bar/mc-mod-update-bar.js"`), once. Tests: `__tests__/`.
