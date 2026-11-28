# mc-civil-rail

The five builder steps: a column of cards (number, name, what is picked, a ! while incomplete) or, on a phone, a bar of numbers. The active step is red-bordered; every step is a focus stop keyed by its action.

| Property | Type                | Meaning                |
| -------- | ------------------- | ---------------------- |
| `steps`  | `BuilderStepView[]` | The steps.             |
| `mode`   | attribute           | wide, tablet or phone. |

Events: `mc-civil-war` `{ type: "act", action }`.

Needs `@mc/ui` defined.
