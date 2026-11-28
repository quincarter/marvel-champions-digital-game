# mc-lobby-competitive

The Competitive (Civil War) seats panel of the room lobby (`LobbyCompetitiveModel`). The page puts it in an `mc-lobby-frame`
(which draws `model.title`).

```text
<mc-lobby-competitive .model=${competitive}></mc-lobby-competitive>
```

| Property   | Type                    | Notes                                                             |
| ---------- | ----------------------- | ----------------------------------------------------------------- |
| `model`    | `LobbyCompetitiveModel` | detail, start result, sizes, teams, people                        |
| `scroller` | `HTMLElement \| null`   | getter: the `list:seats` region (`data-key`) the pad's stick uses |

Content, top to bottom, all inside the one native scroller: the detail line; the start result (a boxed headline, its lines and
Dismiss) when there is one; the host's 1v1 / 2v2 buttons (`sizes`, null once started or for a guest); one `mc-lobby-team` per
side (keyed by team); the people, one `line` each under an `mc-section-heading`.

Events: `mc-room-lobby` through the panel's `FeatureRelay<LobbyEvent>`: `{ type: "competitive", key: "comp:size1" | "comp:size2" }`
and the result's `{ type: "dismiss-result" }`, both the model's own `command`s on `mc-lobby-button`s.

Needs `@mc/ui` defined (`mc-section-heading`) and the seats section's `mc-lobby-seat-row` for each team's seats.
