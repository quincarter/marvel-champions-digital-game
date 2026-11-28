# mc-pack-status

The line over a pack page's buttons: progress while installing, the last failure in words, or the requirement the pack waits on. It keeps its height with nothing to say.

Properties are declared in `mc-pack-status.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-pack-status/mc-pack-status.js"`), once. Tests: `__tests__/`.
