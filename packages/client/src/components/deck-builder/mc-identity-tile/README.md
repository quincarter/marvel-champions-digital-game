# mc-identity-tile

A hero on the picker: the hero art over a name bar. A tap anywhere on it picks the hero; a hold, right-click or the route Inspect opens the hero card. A McPress: it raises mc-pressed with the event it stands for.

```html
<mc-identity-tile></mc-identity-tile>
```

| Property | Type              | Notes             |
| -------- | ----------------- | ----------------- |
| model    | IdentityTileModel | id, name, picture |

| Event      | Detail                                    |
| ---------- | ----------------------------------------- |
| mc-pressed | action pick-hero, holdAction hero-inspect |

Focus stops: identity:<id>

Uses: mc-card-art (@mc/ui)

The parent imports `mc-identity-tile/mc-identity-tile` once; shared `@mc/ui` elements are defined by the ui entry.
