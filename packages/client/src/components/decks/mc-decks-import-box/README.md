# mc-decks-import-box

The Import / Export box at the foot of the deck list: Paste and CDB link (an accordion: one opens its own field and Import
button), and Export (acts at once on the selected deck).

| Property | Type                                  |
| -------- | ------------------------------------- |
| `model`  | `DecksImportModel` (`decks.types.ts`) |

| Event            | Detail                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `mc-decks`       | `{ type: "action", action }` for the toggles, Export and the two Imports; `{ type: "input", field, text }` |
| `mc-field-focus` | `{ focused }`, from a field (composed)                                                                     |

The fields show the text the scene accepted (`pasteText`, `marvelcdbText`). `fieldOf(key)` gives a field to blur.

Focus stops: `ie-paste-toggle`, `ie-marvelcdb-toggle`, `ie-export`, `paste-field`, `paste-import`, `marvelcdb-field`,
`marvelcdb-import`.
