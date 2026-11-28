# mc-civil-sheet

Cards in this set: an `mc-dialog` listing each distinct card (name, copies, type), with Add or Remove this set and Close in the footer.

| Property   | Type            | Meaning                      |
| ---------- | --------------- | ---------------------------- |
| `sheet`    | `SetSheetView`  | The cards.                   |
| `pictures` | `CivilPictures` | Pictures.                    |
| `set-id`   | attribute       | The set.                     |
| `picked`   | attribute       | The set is chosen.           |
| `enabled`  | attribute       | It can be picked or removed. |
| `reason`   | attribute       | Why not.                     |

Events: `mc-civil-war` `inspect`, `act` for `civil:set:<id>`, `sheet` with a null id to close.

Needs `@mc/ui` defined.
