# mc-reader-nav

The ink foot of the text: PREV and NEXT through the whole book, whatever the search shows. Focus stops `prev` and `next`; at an end the button is dimmed and does nothing.

## Properties

| Name       | Type    | Meaning                          |
| ---------- | ------- | -------------------------------- |
| `wide`     | boolean | Roomier padding.                 |
| `at-start` | boolean | First section: PREV is dimmed.   |
| `at-end`   | boolean | Last section: NEXT is dimmed.    |

## Events

`mc-reader`: `prev`, `next`.
