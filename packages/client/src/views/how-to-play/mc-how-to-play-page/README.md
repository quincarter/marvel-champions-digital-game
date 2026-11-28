# mc-how-to-play-page

The How to play hub, the whole screen, composed of its sections and nothing else: the ink header, THE BASICS, ASPECTS, REFERENCE, NEW IN EACH BOX and Continue learning.

## Usage

The scene mounts it as its panel region's content and sets its properties (`dom/element-region.ts` `mountElement`):

```ts
const { region, element } = mountElement(this, "mc-how-to-play-page", rect);
element.mode = "wide";
element.model = model;
element.addEventListener("mc-learn", (event) => act(event.detail));
```

## Properties

| Name    | Type               | Meaning                                     |
| ------- | ------------------ | ------------------------------------------- |
| `mode`  | string             | `wide` (two columns) or `narrow` (default). |
| `model` | HowToPlayPageModel | What it shows, already translated.          |

`scroller` is the body's native scroll container.

## Events

`mc-learn` (`LearnEventDetail`): `close`, `lesson`, `aspect`, `reference`, `box`, `continue`.

## Slots

None.
