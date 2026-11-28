# mc-quick-filters

Cost chips 0 to 5+, resource icon chips and a trait stepper (issue 531). Each chip toggles. A wide column puts everything on one row; a narrow one stacks cost, icons and the stepper.

```html
<mc-quick-filters></mc-quick-filters>
```

| Property | Type              | Notes                      |
| -------- | ----------------- | -------------------------- |
| model    | QuickFiltersModel | label, costs, icons, trait |

| Event           | Detail                      |
| --------------- | --------------------------- |
| mc-deck-builder | quick { id }, trait { dir } |

Focus stops: quick:cost:<n>, quick:icon:<icon>, trait:prev, trait:name, trait:next

Uses: mc-button, mc-stepper (@mc/ui)

The parent imports `mc-quick-filters/mc-quick-filters` once; shared `@mc/ui` elements are defined by the ui entry.
