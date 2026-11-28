# mc-decks-stats

The ink rail of the selected deck (the wide layout's third pane, the narrow layout's Stats tab): its name and meta line, then
under the This deck / From your games tabs either its numbers (cost curve as `mc-bar-chart`, composition as `mc-stat-tile`s,
Check / Edit / Delete, when it last changed) or the games view (`mc-decks-games`), or a pool card in their place
(`mc-decks-card-view`). Duplicate and the red Play are pinned at the foot. A community deck shows `mc-decks-community`; with
nothing selected the pane says so.

| Property | Type                                 |
| -------- | ------------------------------------ |
| `model`  | `DecksStatsModel` (`decks.types.ts`) |

| Event      | Detail                                                    |
| ---------- | --------------------------------------------------------- |
| `mc-decks` | `{ type: "action", action }` for the tabs and the buttons |

Focus stops: `pane:deck`, `pane:games`, `stats-check`, `stats-edit`, `stats-delete`, `stats-duplicate`, `stats-play`, and the
children's (`games-against`, `games-open`, `card-back`, `card-inspect`, the community rail's).
