# mc-value-stepper

Previous, a named middle and next as three mc-button parts: a value that steps through choices (a pack, a trait, a draw count). The middle is chosen while a value is picked; each part has its own focus-stop key.

```html
<mc-value-stepper></mc-value-stepper>
```

| Property                                      | Type    | Notes                        |
| --------------------------------------------- | ------- | ---------------------------- |
| label                                         | string  | the middle words, translated |
| selected                                      | boolean | the middle is chosen         |
| prev-stop / name-stop / next-stop             | string  | focus stop keys              |
| prev-disabled / name-disabled / next-disabled | boolean | dimmed, a press does nothing |

| Event                  | Detail                       |
| ---------------------- | ---------------------------- |
| mc-value-stepper-press | { part: prev, name or next } |

The parent imports `mc-value-stepper/mc-value-stepper` once; shared `@mc/ui` elements are defined by the ui entry.
