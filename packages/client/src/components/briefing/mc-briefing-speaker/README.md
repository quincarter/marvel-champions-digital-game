# Briefing speaker

`<mc-briefing-speaker>`

Whoever the story briefing line speaks as (a hero, the villain, an NPC, or the first seat for narration): a round portrait with a 3px ink ring and the speech bubble beside it. A voice with no picture draws its initial rather than somebody else face.

## Usage

```html
<mc-briefing-speaker></mc-briefing-speaker>
```

## Properties

| Name    | Kind      | What it is                                       |
| ------- | --------- | ------------------------------------------------ |
| `model` | property  | `SpeakerModel`.                                  |
| `phone` | attribute | The phone size: a 64px portrait instead of 84px. |

## Events

- none

## Files

- `McBriefingSpeaker.ts`: the class
- `mc-briefing-speaker.ts`: the define file (registers the element once)
- `mc-briefing-speaker.styles.ts`: the constructible stylesheet
- `mc-briefing-speaker.types.ts`: the property and event types
- `__tests__/`: the tests
