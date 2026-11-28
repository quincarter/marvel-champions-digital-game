# mc-save-data-page

Settings > Save data as one element: the ink `mc-top-bar`, then the step (the six action rows, the replace confirm, Send or Receive) and the status line under it. The body scrolls natively.

| Property | Type                | Meaning              |
| -------- | ------------------- | -------------------- |
| `model`  | `SaveDataPageModel` | What the page shows. |
| `phone`  | attribute           | Set from the model.  |

Events: `mc-save-data` `SaveDataEventDetail` from any section, `back` from the bar.

Needs `@mc/ui` defined.
