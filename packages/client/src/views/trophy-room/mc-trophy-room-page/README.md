# mc-trophy-room-page

The Trophy Room as one page element. It composes sections and nothing else: `mc-top-bar` (Back, the title, and the "Your
stats" button in its `end` slot), `mc-trophy-rank` (rank, points, bar to the next rank), `mc-trophy-filters` (the sort and
Expand all), `mc-trophy-list` (families and achievements) and, over everything while one is open, `mc-trophy-sheet`.
Layout is CSS flex with native scrolling; `model.phone` (the scene's form factor) picks the bar's height and the gutters.

The scene mounts it with `mountElement`, sets `model` (`TrophyRoomPageModel`) and handles `mc-trophy-room`
(`TrophyRoomEventDetail`, `components/trophy-room/shared/`).

| Property | Type                                   | Notes                               |
| -------- | -------------------------------------- | ----------------------------------- |
| `model`  | `TrophyRoomPageModel \| null`          | rebuilt by the scene on each change |
| `phone`  | boolean (reflected from `model.phone`) | the bar's height and the gutters    |

`listScroller` is the list's scrolling box, for the scene's reads.
