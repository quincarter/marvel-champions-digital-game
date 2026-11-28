# mc-lobby-tabs

The lobby's tab strip on the narrow layouts, built on `mc-tab-rail`.

| Property | Type             | Notes                                                         |
| -------- | ---------------- | ------------------------------------------------------------- |
| `model`  | `LobbyTabsModel` | the cells (a Chat cell may carry a `badge`) and the chosen id |

| Event           | Detail                               |
| --------------- | ------------------------------------ |
| `mc-room-lobby` | `{ type: "tab", tab: LobbyPanelId }` |

Stops: `tab:<id>`.
