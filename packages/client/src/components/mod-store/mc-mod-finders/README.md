# mc-mod-finders

The controls over a tab's grid: the search box (a real input) and the sort, a row of chips (`mc-filter-bar`) with Clear, and the count. The box's own `mc-search` and `mc-search-focus` pass through. Events: `mc-mod-store` `{ type: "sort" }`, `{ type: "chip", id }` and `{ type: "clear" }`.

Properties are declared in `mc-mod-finders.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-mod-finders/mc-mod-finders.js"`), once. Tests: `__tests__/`.
