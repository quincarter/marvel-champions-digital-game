# mc-civil-stages

Step 3: a row per main scheme stage offering printed cards (name, target threat, gist, Read card). A blind scenario shows a card back and Stage 2 hidden.

| Property   | Type             | Meaning                      |
| ---------- | ---------------- | ---------------------------- |
| `rows`     | `StageRowView[]` | The rows.                    |
| `pictures` | `CivilPictures`  | Pictures.                    |
| `summary`  | attribute        | The sentence under the rows. |

Events: `mc-civil-war` `act` for an option, `inspect` to read it.

Needs `@mc/ui` defined.
