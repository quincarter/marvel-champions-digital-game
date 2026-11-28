# mc-past-game-actions

A game's four actions: Watch (primary, full width) over Share link, Export and Log. Each button is a focus stop
(`action:watch`, `action:share`, `action:export`, `action:log`). While one action runs (`busy`) all four are dimmed and
press nothing; the running one says "Working..." in its label (the scene words it).

| Property  | Attribute | Type                                |
| --------- | --------- | ----------------------------------- |
| `gameId`  | `game-id` | string                              |
| `actions` | -         | `PastGameActionButton[]` (`.types`) |
| `busy`    | `busy`    | boolean                             |

Event: `mc-past-games` `{ type: "action", id, action }`. Needs `@mc/ui` (`mc-button`).
