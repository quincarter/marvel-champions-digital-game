# mc-civil-leaders

Step 2: a card per leader (picture, name, stages and hit points, the set always in) with each stage's printed card under it and a Read stage button.

| Property      | Type             | Meaning                       |
| ------------- | ---------------- | ----------------------------- |
| `leaders`     | `LeaderChoice[]` | The leaders.                  |
| `pictures`    | `CivilPictures`  | Pictures.                     |
| `expert-note` | attribute        | Shown on each card in Expert. |

Events: `mc-civil-war` `act` for a leader, `inspect` to read a stage.

Needs `@mc/ui` defined.
