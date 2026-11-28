# mc-reader-contents

The book's table of contents with its search, built on the generic `mc-search-hits` (`@mc/ui`): the field, a phone's PDF buttons under it, and the rows the search left. The scene matches (`searchBook`); this says what was typed and which row was pressed.

## Properties

| Name           | Type         | Meaning                                                     |
| -------------- | ------------ | ----------------------------------------------------------- |
| `query`        | string       | The search field's text.                                    |
| `pad-keyboard` | boolean      | A Steam pad is in use (the focused field says how to type). |
| `hits`         | `McTocRow[]` | The sections left, keyed `toc:<index>`.                     |
| `current`      | string       | The open section's key, or "".                              |
| `pdfs`         | `string[]`   | A phone's PDF button labels, under the field.               |

## Events

`mc-reader`: `search`, `search-focus`, `toc` (and `pdf` from its buttons). The field's own `mc-search` is stopped here.
