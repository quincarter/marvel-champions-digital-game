# mc-controls-page

Settings > Controls as one element: the ink `mc-top-bar`, the tab rail and pad status line, then one scrolling body of the drawing, the settings rows, the lists and the disabled Remap buttons.

| Property | Type                | Meaning              |
| -------- | ------------------- | -------------------- |
| `model`  | `ControlsPageModel` | What the page shows. |
| `phone`  | attribute           | Set from the model.  |

Events: `mc-controls` `ControlsEventDetail` from any section; `back` from the bar and `tab` from the rail.

Needs `@mc/ui` defined.
