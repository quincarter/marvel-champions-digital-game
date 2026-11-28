# mc-report-issue

The "Report an issue" dialog: three steps and a close button, over a scrim.

Opened by the Report button and by Pause (`scenes/report-issue.ts`).

## Markup

```html
<mc-report-issue></mc-report-issue>
```

## Properties

| Property | Type              | Notes |
| -------- | ----------------- | ----- |
| `model`  | `ReportIssueModel | null` | title, close, steps, feedback, columns (1 or 2), phone, scrim, glyphs |

## Events

- `mc-activate` (bubbles, composed): `{ key }`: a step button or `close`

## Made of

- `mc-report-step`

## Files

`mc-report-issue.ts` defines the element (guarded), `McReportIssue.ts` is the class, `mc-report-issue.styles.ts` its `css`, `mc-report-issue.types.ts` the model and event types.
