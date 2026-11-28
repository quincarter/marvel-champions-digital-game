# mc-pause-keyword

One keyword or status card of Pause's Rules reference pane. A status is a filled card in its own colour; its term is always the plain word. A tap opens Rules reference on the term; a mouse over the card's name opens the card hover.

## Usage

```ts
html`<mc-pause-keyword .keyword=${entry}></mc-pause-keyword>`;
```

## Properties

| Name      | Type                                       | Meaning                                     |
| --------- | ------------------------------------------ | ------------------------------------------- |
| `keyword` | `PauseKeywordInput`                        | The card; its stop and action come from it. |
| `tone`    | `plain` / `stunned` / `confused` / `tough` | Reflected from the keyword.                 |

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`. `mc-card-hover`, `mc-card-hover-end` and `mc-card-inspect` from the card's name (`watchCard`).

## Slots

None. Focus stop: `keyword:<id>`.
