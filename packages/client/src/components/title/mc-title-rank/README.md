# mc-title-rank

The Title rank card: rank, lifetime points, a bar to the next rank and its caption. Red while a rank-up is announced.

| Property | Meaning                                                    |
| -------- | ---------------------------------------------------------- |
| `input`  | `TitleRankInput`: label, title, points, caption, fraction. |
| `stop`   | Its focus stop (`rank-badge`), set by the page.            |
| `action` | What a tap raises (the same key).                          |

Events: `mc-pressed`. Slots: none. The card has no width of its own: the page sizes it.
