# Briefing deck row

`<mc-briefing-deck-row>`

One seat deck on the Decks panel: "HERO · ASPECT" in Bangers, the deck count and a "▸". The whole row is a button into that seat own deck (a swipe that lifts over it does not press it). A row naming a problem wraps it under the hero in red behind a "!".

## Usage

```html
<mc-briefing-deck-row></mc-briefing-deck-row>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `row` | property | `DeckRowModel`. |
| `stop` | attribute | The focus stop key (`deck-seat-<n>`). |

## Events

- `mc-pressed`: `PressDetail` whose `action` is `{ type: "edit-decks", seat }`.

## Files

- `McBriefingDeckRow.ts`: the class
- `mc-briefing-deck-row.ts`: the define file (registers the element once)
- `mc-briefing-deck-row.styles.ts`: the constructible stylesheet
- `mc-briefing-deck-row.types.ts`: the property and event types
- `__tests__/`: the tests
