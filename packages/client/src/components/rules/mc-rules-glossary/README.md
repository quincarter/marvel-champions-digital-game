# mc-rules-glossary

The Glossary tab: a natively scrolling grid of `mc-rules-entry` cards (one to three across, 300px at least), or what to say when the search matches nothing. This element registers `mc-rules-entry`.

## Properties

| Name      | Type                | Meaning                     |
| --------- | ------------------- | --------------------------- |
| `entries` | `RulesEntryModel[]` | The terms, in order.        |
| `empty`   | string              | What it says with no match. |

## Events

None of its own: `mc-rules` from the entries passes through. `scroller` gives the grid's scrolling element.
