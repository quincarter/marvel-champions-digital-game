# mc-deck-check-page

The Deck Check page. It only composes: the header, then the wide layout (rail of `mc-deck-composition`, `mc-deck-type-filter` and
`mc-cost-curve`; `mc-deck-card-sections`; `mc-deck-list-panel` with `mc-deck-actions`) or a narrow layout (`mc-tab-rail`, one tab's
body, the footer). The scene mounts it with `mountElement`, sets `size`, `tab`, `typeFilter`, `openTip` and `model`
(`DeckCheckPageModel`), and listens for `mc-deck-check` (`DeckCheckEventDetail`).

The open tip's plate (`mc-tip-plate`) is seated in this page's own coordinates beside its segment, over the filters.
Layout is `responsive.styles.ts`: grid and flex with native scrolling.
