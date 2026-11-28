# mc-reader-text

The open section: a tools row over a natively scrolling `mc-article` (`@mc/ui`). A wide screen has the PDF buttons at the right of the row; a phone has a CONTENTS button there.

## Properties

| Name          | Type             | Meaning                                              |
| ------------- | ---------------- | ---------------------------------------------------- |
| `wide`        | boolean          | PDF buttons (wide) or a CONTENTS button (phone).     |
| `article`     | `McArticleModel` | The title and blocks of the section.                 |
| `picture-max` | number           | The tallest a page picture gets, in px.              |
| `pdfs`        | `string[]`       | PDF button labels (wide only).                       |

## Events

`mc-reader`: `contents` (and `pdf` from its buttons). `scroller` gives the article's scrolling element.
