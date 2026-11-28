# Briefing modular-set call

`<mc-briefing-modular>`

The modular-set call: the question, its explanation, one tile per set and the lines under them. A set already chosen wears a green stripe and its words; one checked off is dimmed and says so in words.

## Usage

```html
<mc-briefing-modular></mc-briefing-modular>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `view` | property | `ModularSetCallView`, its sentences already in the player language. |

## Events

- `mc-briefing`: `{ type: "answer", picked: [setId] }`.

## Files

- `McBriefingModular.ts`: the class
- `mc-briefing-modular.ts`: the define file (registers the element once)
- `mc-briefing-modular.styles.ts`: the constructible stylesheet
- `mc-briefing-modular.types.ts`: the property and event types
- `__tests__/`: the tests
