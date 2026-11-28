# mc-unlocks-page

Settings > Unlocks as one element: the ink `mc-top-bar` (Back, the title, the door to How it works in its end slot), then the points, the two switches and the list, or the guide text.

| Property | Type               | Meaning              |
| -------- | ------------------ | -------------------- |
| `model`  | `UnlocksPageModel` | What the page shows. |
| `phone`  | attribute          | Set from the model.  |

Events: `mc-unlocks` `UnlocksEventDetail` from any section, `back` and `guide` from the bar.

Needs `@mc/ui` defined.
