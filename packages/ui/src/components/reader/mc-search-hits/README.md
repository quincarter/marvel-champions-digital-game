# mc-search-hits

A search field over the list of what it found: `mc-search-field` and an `mc-toc` of the hits. The matching belongs to the screen (accent-free, fuzzy); this shows the text typed and the rows handed back, and says so when none match.

## Properties

| Name                | Type         | Meaning                                    |
| ------------------- | ------------ | ------------------------------------------ |
| `query`             | string       | The text in the field.                     |
| `placeholder`       | string       | Its placeholder (translated).              |
| `focus-placeholder` | string       | What it says while focused on a Steam pad. |
| `clear-label`       | string       | The clear button's accessible name.        |
| `rows`              | `McTocRow[]` | The hits.                                  |
| `selected`          | string       | The open hit's key.                        |
| `empty`             | string       | What it says when nothing matches.         |
| `search-stop`       | string       | The field's `data-stop` ("search").        |

## Slots

`after`: between the field and the list (a phone shows its PDF buttons there).

## Events

`mc-search`, `mc-search-focus` (from the field) and `mc-activate` (from the list) pass through unchanged.
