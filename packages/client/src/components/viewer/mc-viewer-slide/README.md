# mc-viewer-slide

The picture shown whole (fitted, never cropped) on the ink ground, with arrows to the file's other pictures at its edges and the caption under it. With no picture it says so in a word. The arrows are the focus stops `prev` and `next`.

## Properties

| Name      | Type            | Meaning                                         |
| --------- | --------------- | ----------------------------------------------- |
| `picture` | `PictureSource` | The picture, or null for none open yet.         |
| `caption` | string          | "Cover" or "Cover · 2 / 5".                     |
| `empty`   | string          | What it says in place of a picture.             |
| `arrows`  | boolean         | The file has more than one picture.             |

## Events

`mc-viewer` `{ type: "step", direction }`; `mc-image-error` from the picture passes through.
