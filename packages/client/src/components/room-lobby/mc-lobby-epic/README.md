# mc-lobby-epic

The Epic seats panel of the room lobby (`LobbyEpicModel`). The page puts it in an `mc-lobby-frame` (which draws `model.title`).

```text
<mc-lobby-epic .model=${epic}></mc-lobby-epic>
```

| Property   | Type                  | Notes                                                             |
| ---------- | --------------------- | ----------------------------------------------------------------- |
| `model`    | `LobbyEpicModel`      | hint, organizer controls, time limit, tables, people              |
| `scroller` | `HTMLElement \| null` | getter: the `list:seats` region (`data-key`) the pad's stick uses |

Content, top to bottom, all inside the one native scroller:

1. the hint;
2. the organizer's block (`organizer`: fewer / more tables, the time-limit button, its note), or `limitLine` as a plain line for
   everyone else;
3. one `mc-lobby-epic-table` per table (keyed by id);
4. the people: an `mc-section-heading` and one `line` each.

Events: `mc-room-lobby` through the panel's `FeatureRelay<LobbyEvent>`. The buttons are `mc-lobby-button`s whose `command` the
scene set (`{ type: "epic", key: "epic:fewer" | "epic:more" | "epic:limit" }`); their `stop` keys come from the model.

Needs `@mc/ui` defined (`mc-section-heading`) and the seats section's `mc-lobby-seat-row` for the tables' seats.
