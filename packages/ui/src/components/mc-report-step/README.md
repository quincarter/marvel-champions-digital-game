# mc-report-step

One step of the Report dialog: a heading, a sentence and rows of buttons.

Used three times by `mc-report-issue`.

## Markup

```html
<mc-report-step></mc-report-step>
```

## Properties

| Property | Type        | Notes        |
| -------- | ----------- | ------------ |
| `step`   | `ReportStep | null`        | key, title, body, rows of buttons |
| `phone`  | `boolean`   | smaller type |

## Events

- `mc-activate` (bubbles, composed): `{ key }`: one of the step buttons

## Files

`mc-report-step.ts` defines the element (guarded), `McReportStep.ts` is the class, `mc-report-step.styles.ts` its `css`, `mc-report-step.types.ts` the model and event types.
