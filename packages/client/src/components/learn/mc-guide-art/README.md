# mc-guide-art

The first-run chooser's picture: the title art over an ink ground and dot grid, an ink scrim and the yellow "NEW TO THE FIGHT?" banner at its foot.

## Usage

```ts
html`<mc-guide-art
  heading="NEW TO THE FIGHT?"
  ?wide=${wide}
  .picture=${{ src, cover: { x: 0.5, y: 0.5 } }}
></mc-guide-art>`;
```

The picture is the panel-size copy the build makes (`art/title-art.ts` `displayCopyOf`), loaded lazily. It is decorative: no press and no focus. Fill its parent (size it with the page's grid).

## Properties

| Name      | Type          | Meaning                                                     |
| --------- | ------------- | ----------------------------------------------------------- |
| `picture` | PictureSource | The title art, or none.                                     |
| `heading` | string        | The banner's words, already translated.                     |
| `wide`    | boolean       | The wide screen's left panel (lighter scrim, wider banner). |

## Events

`mc-image-error` (bubbles, composed) when the picture's URL failed to load.

## Slots

None.
