# mc-lobby-team

One side's card in a Competitive room, inside `mc-lobby-competitive`.

```text
<mc-lobby-team .model=${team}></mc-lobby-team>
```

| Property | Type                     | Notes                                    |
| -------- | ------------------------ | ---------------------------------------- |
| `model`  | `LobbyTeamModel \| null` | title, status, seats, speak, seal, ready |
| `mine`   | `boolean` (reflected)    | set from `model.mine`: a heavier border  |

Parts: the title (`data-key="team:<team>"`), the status line (bold), one block per seat (an `mc-lobby-seat-row`, the seats
section's element, and the "Move to ..." `mc-lobby-button` when the model has one), then the `speak` (host without a seat),
`seal` and `ready` buttons.

Events: its own `FeatureRelay<LobbyEvent>` turns a button's `mc-pressed` into `mc-room-lobby`; the commands are the scene's
(`{ type: "competitive", key: "team:<seat>" | "speak:<team>" | "seal:<team>" | "ready:<team>" }`). A disabled seal or Ready with a
`reason` raises `blocked` (from `mc-lobby-button`).

Pure Lit: no state of its own; text comes from the model.
