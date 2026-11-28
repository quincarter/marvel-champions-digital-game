# mc-player-stats-page

Your stats as one page element. It only composes: the header (`mc-stats-header`), the tab row (`mc-stats-tabs`), the controls under it (`mc-stats-controls`), then a tab's list (`mc-stats-list`, with `mc-stats-matchup-side` beside it on the Focus view), the Matchups grid (`mc-stats-matchup-grid`) or a word while the saves are read. Sections live in `components/player-stats/`; the scene (`scenes/player-stats.ts`) mounts the page with `mountElement`, sets `model` from `view/player-stats-page-model.ts` and listens for `mc-player-stats`.

## Properties

| Name    | Type                      | Meaning                                   |
| ------- | ------------------------- | ----------------------------------------- |
| `model` | StatsPageModel (property) | Everything drawn, already worded.         |
| `mode`  | wide \| phone             | The outer gutter (24px, 16px on a phone). |

## Events

`mc-player-stats` (`StatsEventDetail`), `mc-player-stats-rendered`, `mc-image-error`, and the card hover and Inspect events from card pictures.
