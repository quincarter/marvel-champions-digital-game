# mc-detail-hero

The hero's facts on the Take your seats detail panel: name (display face), the deck credit, the stat line, a rule, then
the obligation and the nemesis as two `mc-detail-fact`s. Words only; no events, no stops. It takes the colour of the
panel it sits on.

```html
<mc-detail-hero .model="${heroDetail}"></mc-detail-hero>
```

| Property | Type                                         | Notes                                                   |
| -------- | -------------------------------------------- | ------------------------------------------------------- |
| `model`  | `HeroDetailModel \| null` (`seats.types.ts`) | null draws nothing; a null `credit` leaves its line out |
