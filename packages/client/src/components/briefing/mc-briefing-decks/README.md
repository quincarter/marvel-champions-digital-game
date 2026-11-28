# Briefing decks

`<mc-briefing-decks>`

The Decks panel: one row per seat, each a way into that seat own deck, and the line under it about what counts toward the deck size. While the issue waits on a call or is composing, the panel says so instead of listing decks.

## Usage

```html
<mc-briefing-decks></mc-briefing-decks>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `model` | property | `DecksModel`. |

## Events

- `mc-briefing`: `{ type: "edit-decks", seat }`.

## Files

- `McBriefingDecks.ts`: the class
- `mc-briefing-decks.ts`: the define file (registers the element once)
- `mc-briefing-decks.styles.ts`: the constructible stylesheet
- `mc-briefing-decks.types.ts`: the property and event types
- `__tests__/`: the tests
