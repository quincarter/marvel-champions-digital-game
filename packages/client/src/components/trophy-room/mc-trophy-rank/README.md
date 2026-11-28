# mc-trophy-rank

The ink header over the Trophy Room's list: "RANK 3 OF 9" and the lifetime points, the rank's name in Bangers, how many
points to the next rank and how many achievements are earned, and a bar toward the next rank (`mc-progress-bar`, paper on
the ink). The words are `trophyHeaderOf`'s (`view/trophy-room-model.ts`).

| Property | Type                              |
| -------- | --------------------------------- |
| `model`  | `TrophyHeader \| null` (`.types`) |
| `phone`  | boolean (attribute)               |

No events, no stops, no slots. Needs `@mc/ui` defined.
