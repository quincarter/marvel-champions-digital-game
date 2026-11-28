# mc-stepper

Previous, a named middle and next as three mc-button parts: a value that steps through choices (a pack, a trait, a draw count). The middle is chosen while a value is picked; each part has its own focus-stop key.

```html
<mc-stepper></mc-stepper>
```

| Property                                      | Type    | Notes                        |
| --------------------------------------------- | ------- | ---------------------------- |
| label                                         | string  | the middle words, translated |
| selected                                      | boolean | the middle is chosen         |
| prev-stop / name-stop / next-stop             | string  | focus stop keys              |
| prev-disabled / name-disabled / next-disabled | boolean | dimmed, a press does nothing |

| Event            | Detail                       |
| ---------------- | ---------------------------- |
| mc-stepper-press | { part: prev, name or next } |

The parent imports `mc-stepper/mc-stepper` once; shared `@mc/ui` elements are defined by the ui entry.
