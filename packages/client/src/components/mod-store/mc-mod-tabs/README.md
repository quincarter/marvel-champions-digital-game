# mc-mod-tabs

The six tabs as one `mc-tab-rail` (two rows of three when the row is narrow) and, on a phone, the magnifier (`mc-search-toggle`) that shows or folds the finders. Events: `mc-mod-store` `{ type: "tab", tab }` and `{ type: "toggle-finders" }`.

Properties are declared in `mc-mod-tabs.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-mod-tabs/mc-mod-tabs.js"`), once. Tests: `__tests__/`.
