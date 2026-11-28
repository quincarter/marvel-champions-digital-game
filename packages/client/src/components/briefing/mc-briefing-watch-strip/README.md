# Briefing watch strip

`<mc-briefing-watch-strip>`

The phone strip just above the action bar, on the page paper so the scrolling briefing never runs under it: the red reason Open issue waits, as tall as it wraps, or, when there is none, the watch toggle. A problem outranks the toggle; with neither the strip is empty.

## Usage

```html
<mc-briefing-watch-strip></mc-briefing-watch-strip>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `reason` | attribute | The reason line, already translated; empty for none. |
| `watch` | property | `WatchModel`, or null for no toggle. |

## Events

- `mc-briefing`: `{ type: "watch" }`.

## Files

- `McBriefingWatchStrip.ts`: the class
- `mc-briefing-watch-strip.ts`: the define file (registers the element once)
- `mc-briefing-watch-strip.styles.ts`: the constructible stylesheet
- `mc-briefing-watch-strip.types.ts`: the property and event types
- `__tests__/`: the tests
