# Briefing shield pictures

`<mc-briefing-shield-pictures>`

A wrapped row of card pictures with a few words under each (the evidence the players hold, the Executive Board). Every picture opens Inspect and is its own focus stop; the words are text, never colour alone.

## Usage

```html
<mc-briefing-shield-pictures></mc-briefing-shield-pictures>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `cards` | property | `ShieldPicture[]`. |
| `key-base` | attribute | The stop keys are `<key-base>-<index>`. |
| `phone` | attribute | Smaller pictures. |

## Events

- `mc-briefing`: `{ type: "inspect", cardId, name }`.

## Files

- `McBriefingShieldPictures.ts`: the class
- `mc-briefing-shield-pictures.ts`: the define file (registers the element once)
- `mc-briefing-shield-pictures.styles.ts`: the constructible stylesheet
- `mc-briefing-shield-pictures.types.ts`: the property and event types
- `__tests__/`: the tests
