# mc-side-story-actions

The ink action bar: BACK (from the second beat on) and the big primary NEXT, or DONE on the last beat, with the Activate glyph while a keyboard or pad is in use. Focus stops `back` and `next`.

## Properties

| Name         | Type        | Meaning                              |
| ------------ | ----------- | ------------------------------------ |
| `has-back`   | boolean     | Not the first beat: BACK shows.      |
| `back-label` | string      | "◂ BACK".                            |
| `next-label` | string      | "NEXT ▸" or "DONE ▸".                |
| `nextGlyph`  | `HintGlyph` | The Activate glyph, or null.         |
| `compact`    | boolean     | A phone's shorter bar.               |

## Events

`mc-side-story`: `back`, `next`.
