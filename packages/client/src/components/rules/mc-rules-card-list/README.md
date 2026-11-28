# mc-rules-card-list

The Card list tab: every encounter set the pool knows in a scrolling list (`mc-rules-card-set`, which this element registers), the running game's own under "IN THIS GAME", the rest under "NOT IN THIS GAME", or what to say when there are none.

## Properties

| Name         | Type                  | Meaning                             |
| ------------ | --------------------- | ----------------------------------- |
| `items`      | `RulesCardListItem[]` | Section labels and sets, in order.  |
| `empty`      | string                | What it says with none.             |
| `card-scale` | number                | The Card size factor.               |
| `caption`    | number                | The tile name strip's height in px. |

## Events

None: `mc-rules` from the sets passes through. `scroller` gives the list's scrolling element.
