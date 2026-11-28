# mc-guide-chooser-page

The first-run chooser ("New to the fight?"), the whole screen, composed of its sections and nothing else: the picture with its banner, the subtitle and three guide levels, and Suit up (and Back, wide).

## Usage

The scene mounts it as its panel region's content and sets its properties (`dom/element-region.ts` `mountElement`):

```ts
const { region, element } = mountElement(this, "mc-guide-chooser-page", rect);
element.mode = "wide";
element.model = model;
element.addEventListener("mc-learn", (event) => act(event.detail));
```

## Properties

| Name    | Type                  | Meaning                                             |
| ------- | --------------------- | --------------------------------------------------- |
| `mode`  | string                | `wide` (picture at the left) or `narrow` (default). |
| `model` | GuideChooserPageModel | What it shows, already translated.                  |

## Events

`mc-learn` (`LearnEventDetail`): `option`, `back`, `suit-up`. `mc-image-error` when the picture's URL failed to load.

## Slots

None.
