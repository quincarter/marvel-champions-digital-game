# mc-reader-pdfs

One button per PDF of the book, side by side. Each is a focus stop, `pdf:<index>`; the scene opens the repo's copy.

## Properties

| Name     | Type       | Meaning                              |
| -------- | ---------- | ------------------------------------ |
| `labels` | `string[]` | One label per PDF, as the book names it. |

## Events

`mc-reader` `{ type: "pdf", index }`. Registered once by the reader page, which composes both of its users (`mc-reader-contents`, `mc-reader-text`).
