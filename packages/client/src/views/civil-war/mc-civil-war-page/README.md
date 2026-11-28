# mc-civil-war-page

The Civil War builder as one element: the ink `mc-top-bar` (title, the status as its subtitle, Show me at the end of a blind build), the step rail, the active step in one scrolling body, the summary column (wide), the sticky foot and, over it, the cards-in-this-set sheet.

| Property | Type             | Meaning                                |
| -------- | ---------------- | -------------------------------------- |
| `model`  | `CivilPageModel` | What the page shows.                   |
| `mode`   | attribute        | wide, tablet or phone, from the model. |

Events: `mc-civil-war` `CivilWarEventDetail` from any section; `act civil:back` from the bar.

Needs `@mc/ui` defined.
