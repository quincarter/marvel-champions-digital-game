# mc-win-card

One way to win or lose as a framed card: a stamp, a title, the card scan it is about and its words.

## Usage

```ts
html`<mc-win-card
  tag="WIN"
  tone="heal"
  heading="Knock out the villain"
  .picture=${scan}
  card-id="rhino"
  .face=${{ kind: "villainStage", sideIndex: 0, stageIndex: 0 }}
>
  Bring Rhino's health to 0 on each of its 2 stages.
</mc-win-card>`;
```

The scan is a card picture (`watchCard` from `@mc/ui`): a mouse over it raises `mc-card-hover`, and a hold `mc-card-inspect`; the scene's `CardEvents` turns them into the hover popover and Inspect. `art="landscape"` keeps a main scheme scan's own shape; `layout="column"` puts the scan over the words (the wide screen's tall WIN card). Size the scan with `--art-height` (104px).

## Properties

| Name       | Type          | Meaning                                  |
| ---------- | ------------- | ---------------------------------------- |
| `tag`      | string        | The stamp's word.                        |
| `tone`     | string        | `heal` or `red`.                         |
| `heading`  | string        | The card's title.                        |
| `picture`  | PictureSource | The scan, or none.                       |
| `card-id`  | string        | The card the scan is of.                 |
| `face`     | unknown       | Which face of it, when not the default.  |
| `art`      | string        | `portrait` (default) or `landscape`.     |
| `layout`   | string        | `row` (default) or `column`.             |
| `fill`     | boolean       | The scan takes the card's whole height.  |
| `scan-key` | string        | Names the scan in the page (`data-key`). |

## Events

`mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect` (from `watchCard`, bubbling and composed) and `mc-image-error` (the scan's URL went stale).

## Slots

- `(default)`: the card's words.
