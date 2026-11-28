# Briefing side scheme

`<mc-briefing-scheme>`

What the answered side-scheme choice leaves on the Briefing (NeXt Evolution, MC40 p. 7): the chosen row with its cards as pictures, "Same as last time" when a retry repeats it, what carries in from the log and the encounter sets the issue fixes. The picker itself is a call (`mc-briefing-scheme-pick`).

## Usage

```html
<mc-briefing-scheme></mc-briefing-scheme>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `model` | property | `SchemeSectionModel`. |

## Events

- `mc-briefing`: `{ type: "inspect", cardId, name }`.

## Files

- `McBriefingScheme.ts`: the class
- `mc-briefing-scheme.ts`: the define file (registers the element once)
- `mc-briefing-scheme.styles.ts`: the constructible stylesheet
- `mc-briefing-scheme.types.ts`: the property and event types
- `__tests__/`: the tests
