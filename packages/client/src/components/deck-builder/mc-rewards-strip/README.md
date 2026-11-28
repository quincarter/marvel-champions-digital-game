# mc-rewards-strip

Campaign mode rewards (MC45 p. 24): every reward the seat chose, in the deck or not, each with its status in words and a button that flips it. The only place a left-out reward can be put back.

```html
<mc-rewards-strip></mc-rewards-strip>
```

| Property | Type         | Notes          |
| -------- | ------------ | -------------- |
| model    | RewardsModel | label, rewards |

| Event           | Detail                      |
| --------------- | --------------------------- |
| mc-deck-builder | reward { cardId, included } |

Focus stops: reward:<at>:<card id>

Uses: mc-button (@mc/ui)

The parent imports `mc-rewards-strip/mc-rewards-strip` once; shared `@mc/ui` elements are defined by the ui entry.
