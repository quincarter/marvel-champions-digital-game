# mc-win-cards

The three cards of How to win: WIN (knock out the villain), LOSE (the main scheme finishes) and LOSE (you go down).

## Usage

```ts
html`<mc-win-cards mode="wide" .input=${{ win, scheme, hero }}></mc-win-cards>`;
```

Wide, the tall WIN card sits at the left and the two LOSE cards stack at the right; narrow, the three stack. The scheme card's words carry the "threat" glossary term (`terms`: `McTermRun`s and their tips): its tip opens over the page. `closeTip()` closes the open tip and says whether one was open (Escape closes it before it leaves the screen).

## Properties

| Name    | Type          | Meaning                                    |
| ------- | ------------- | ------------------------------------------ |
| `input` | WinCardsInput | The three cards (`win`, `scheme`, `hero`). |
| `mode`  | string        | `wide` or `narrow` (default).              |

## Events

- `mc-learn` (bubbles, composed): `{ type: "glossary", heading }` from a tip's link and `{ type: "tip", open }` when a tip opens or closes.
- The scans' `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect` and `mc-image-error` pass through.

## Slots

None.
