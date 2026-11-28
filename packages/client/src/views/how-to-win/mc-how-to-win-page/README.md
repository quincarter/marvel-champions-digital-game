# mc-how-to-win-page

How to win (lesson 1 of 5), the whole screen, composed of its sections and nothing else: the ink header, the headline, the three cards, the EVERY ROUND strip and the two actions.

## Usage

The scene mounts it as its panel region's content and sets its properties (`dom/element-region.ts` `mountElement`):

```ts
const { region, element } = mountElement(this, "mc-how-to-win-page", rect);
element.mode = "wide";
element.model = model;
element.addEventListener("mc-learn", (event) => act(event.detail));
```

## Properties

| Name    | Type              | Meaning                                              |
| ------- | ----------------- | ---------------------------------------------------- |
| `mode`  | string            | `wide` (two columns of cards) or `narrow` (default). |
| `model` | HowToWinPageModel | What it shows, already translated.                   |

`closeTip()` closes the open glossary tip and says whether one was open; `scroller` is the page's native scroll container.

## Events

- `mc-learn` (`LearnEventDetail`): `close`, `tell-more`, `start`, `glossary`, `tip`.
- `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect` from the scans; `mc-image-error` when a scan's URL went stale.

## Slots

None.
