# Briefing call

`<mc-briefing-call>`

"Your call": the question the engine asked while composing the issue. It opens with the head and, for a plain pick, the prompt, then switches on the kind of question (role-building, the side-scheme pick, the modular-set pick, the role tiles and their confirm step, or a list of options). What is legal is the engine offer, never decided here.

## Usage

```html
<mc-briefing-call></mc-briefing-call>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `call` | property | `CallModel`. |

## Events

- `mc-briefing`: `{ type: "answer", picked }` and `inspect`.

## Files

- `McBriefingCall.ts`: the class
- `mc-briefing-call.ts`: the define file (registers the element once)
- `mc-briefing-call.styles.ts`: the constructible stylesheet
- `mc-briefing-call.types.ts`: the property and event types
- `__tests__/`: the tests
