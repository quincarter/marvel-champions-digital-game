# mc-rules-entry

One glossary term as a bordered card: the term, its definition, its source, any player note, the "Added in ..." link (with no game running) and a strip of the cards that carry it right now, each opening Inspect (a tile is a button with a lazy scan, a hover popover and a hold's Inspect). A status also wears a stripe, but the word is always the term. The card is a focus stop, `row:entry:<id>`; each tile is `row:entry:<id>:card:<cardId>`. Enter follows the origin link or opens the first card; Inspect opens the first card.

## Properties

| Name    | Type              | Meaning                         |
| ------- | ----------------- | ------------------------------- |
| `entry` | `RulesEntryModel` | The term as the scene words it. |

## Events

`mc-rules`: `card` (`key`) and `origin` (`boxId`); `mc-image-error` from a scan passes through.
