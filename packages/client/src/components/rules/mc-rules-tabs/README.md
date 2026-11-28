# mc-rules-tabs

The three tabs of the Rules reference (Glossary, Villain phase, Card list) as the generic `mc-tab-rail` (`@mc/ui`). Focus stops `tab:<id>`.

## Properties

| Name       | Type           | Meaning               |
| ---------- | -------------- | --------------------- |
| `tabs`     | `TabRailTab[]` | The tabs, translated. |
| `selected` | string         | The chosen tab's id.  |

## Events

`mc-rules` `{ type: "tab", tab }`.
