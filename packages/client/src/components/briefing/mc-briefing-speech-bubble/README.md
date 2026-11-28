# Briefing speech bubble

`<mc-briefing-speech-bubble>`

The white speech bubble of the story line: a 3px ink border, an offset ink shadow and a tail pointing left at the portrait. The speaker is named in Hero Red capitals over the words when the story names one.

## Usage

```html
<mc-briefing-speech-bubble></mc-briefing-speech-bubble>
```

## Properties

| Name      | Kind      | What it is                                           |
| --------- | --------- | ---------------------------------------------------- |
| `text`    | attribute | The line, already translated.                        |
| `speaker` | attribute | Who says it, already translated; none for narration. |

## Events

- none

## Files

- `McBriefingSpeechBubble.ts`: the class
- `mc-briefing-speech-bubble.ts`: the define file (registers the element once)
- `mc-briefing-speech-bubble.styles.ts`: the constructible stylesheet
- `mc-briefing-speech-bubble.types.ts`: the property and event types
- `__tests__/`: the tests
