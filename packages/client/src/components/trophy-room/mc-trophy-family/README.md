# mc-trophy-family

A family's heading in the Trophy Room's list: a chevron, the Bangers name in capitals with the rule running on
(`mc-section-heading`), and how many of its achievements are earned. It is the control that folds or opens the family: an
`McPress`, so a tap (never the lift that ends a swipe) or the route's Enter raises `mc-pressed` with the `action` the list
gave it, which the list's relay turns into `mc-trophy-room` `{ type: "family", id }`. `aria-expanded` follows the model.

| Property    | Type                                   | Notes                       |
| ----------- | -------------------------------------- | --------------------------- |
| `model`     | `TrophyFamilyModel \| null` (`.types`) | the `section` row           |
| `phone`     | boolean (attribute)                    | a slimmer heading           |
| `data-stop` | string                                 | `sec:<id>`, set by the list |

Event: `mc-pressed`. Needs `@mc/ui` defined.
