# mc-lobby-epic-table

One Epic table's card in the room lobby, inside `mc-lobby-epic`.

```text
<mc-lobby-epic-table .model=${table}></mc-lobby-epic-table>
```

| Property | Type                          | Notes                                      |
| -------- | ----------------------------- | ------------------------------------------ |
| `model`  | `LobbyEpicTableModel \| null` | name, facts, host line, controls and seats |
| `mine`   | `boolean` (reflected)         | set from `model.mine`: a heavier border    |

Parts: the name (`data-key="epic-table:<id>"`), the facts line, the host line, each `controls` row as an `mc-lobby-button-row`,
then one `mc-lobby-seat-row` per seat (the seats section's element; this card does not draw a row itself).

Events: its own `FeatureRelay<LobbyEvent>` turns a button's `mc-pressed` into `mc-room-lobby` (`{ type: "epic", key }` for the
control buttons, with the scene's stop keys such as `rename:<table>`, `drop:<table>`). A seat row's events (`seat`,
`seat-deck`, ...) are raised by the row itself.

Pure Lit: no state of its own; text comes from the model.
