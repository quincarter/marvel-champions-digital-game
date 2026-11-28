# mc-stats-portrait-tile

A hero's or villain's picture with its name and record: a banner, standing tall on a wide Overview, or a picture over the words.

## Usage

```ts
html`<mc-stats-portrait-tile variant="hero" name="Spider-Man" .picture=${picture}></mc-stats-portrait-tile>`;
```

## Properties

| Name                            | Type                     | Meaning             |
| ------------------------------- | ------------------------ | ------------------- |
| `variant`                       | hero                     | stack               | The look. |
| `label / name / detail / extra` | string                   | The words.          |
| `picture`                       | PictureSource (property) | The leased picture. |

## Events

None.

## Slots

None.
