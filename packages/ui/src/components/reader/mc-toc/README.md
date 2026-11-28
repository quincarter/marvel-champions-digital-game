# mc-toc

A table of contents: a scrolling list of rows, one marked as the open section. A row is a focus stop (`data-stop` is its key); a tap, or the focus route pressing it with `click()`, raises `mc-activate`.

## Properties

| Name       | Type         | Meaning                                                   |
| ---------- | ------------ | --------------------------------------------------------- |
| `rows`     | `McTocRow[]` | `{ key, title }`, in order.                               |
| `selected` | string       | The `key` of the open row (inverted, and `aria-current`). |
| `empty`    | string       | What it says when there are no rows (translated).         |

## Events

`mc-activate` (bubbles, composed): `{ key }`.
