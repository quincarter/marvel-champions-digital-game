# Briefing seat picker

`<mc-briefing-seat-picker>`

"Edit which deck?": one button per seat over a scrim that takes every press, opened by EDIT DECKS when several seats could be meant and none is the problem. A tap on the scrim, or Cancel, closes it.

## Usage

```html
<mc-briefing-seat-picker></mc-briefing-seat-picker>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `model` | property | `SeatPickerModel`. |

## Events

- `mc-briefing`: `{ type: "edit-decks", seat }` or `{ type: "close-seat-picker" }`.

## Files

- `McBriefingSeatPicker.ts`: the class
- `mc-briefing-seat-picker.ts`: the define file (registers the element once)
- `mc-briefing-seat-picker.styles.ts`: the constructible stylesheet
- `mc-briefing-seat-picker.types.ts`: the property and event types
- `__tests__/`: the tests
