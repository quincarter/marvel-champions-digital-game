# mc-search-help

The deck builder search cheat sheet (issue 531) as a dialog: every search term, how they combine, and ready examples with Use (puts it in the search and closes) and Copy. Mounted as an overlay by the search help scene.

```html
<mc-search-help></mc-search-help>
```

| Property | Type            | Notes                       |
| -------- | --------------- | --------------------------- |
| model    | SearchHelpModel | title, labels, rows, copied |

| Event             | Detail                           |
| ----------------- | -------------------------------- |
| mc-deck-builder   | help-use, help-copy, sheet-close |
| mc-dialog-dismiss | a tap on the scrim               |

Focus stops: use:<row>, copy:<row>, back

Uses: mc-dialog, mc-button (@mc/ui)

The parent imports `mc-search-help/mc-search-help` once; shared `@mc/ui` elements are defined by the ui entry.
