# mc-games-against

The Against block of From your games: a stepper over the villains, a You / Everyone switch for whose decks are read, a note saying why there is nothing to read yet and, on Everyone with sharing off, a Share my games button.

```html
<mc-games-against></mc-games-against>
```

| Property | Type              | Notes                         |
| -------- | ----------------- | ----------------------------- |
| model    | GamesAgainstModel | stepper, sources, note, share |

| Event           | Detail                                                   |
| --------------- | -------------------------------------------------------- |
| mc-deck-builder | games-step { dir }, games-source { source }, games-share |

Focus stops: games:previous, games:against, games:source:yours, games:source:everyone, games:share

Uses: mc-button (@mc/ui)

The parent imports `mc-games-against/mc-games-against` once; shared `@mc/ui` elements are defined by the ui entry.
