# Briefing side-scheme pick

`<mc-briefing-scheme-pick>`

The player-side-scheme call (NeXt Evolution, MC40 p. 7): one row per offered scheme with its cards as pictures and a PICK button that answers with the row name. A picture opens Inspect and answers nothing.

## Usage

```html
<mc-briefing-scheme-pick></mc-briefing-scheme-pick>
```

## Properties

| Name    | Kind     | What it is         |
| ------- | -------- | ------------------ |
| `model` | property | `SchemePickModel`. |

## Events

- `mc-briefing`: `{ type: "answer", picked: [name] }`, or an `inspect`.

## Files

- `McBriefingSchemePick.ts`: the class
- `mc-briefing-scheme-pick.ts`: the define file (registers the element once)
- `mc-briefing-scheme-pick.styles.ts`: the constructible stylesheet
- `mc-briefing-scheme-pick.types.ts`: the property and event types
- `__tests__/`: the tests
