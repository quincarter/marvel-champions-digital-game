# mc-term-text

A sentence with glossary terms in it: each term is a dotted word that opens its definition on an ink plate.

## Usage

```ts
html`<mc-term-text
  .runs=${[
    { kind: "text", text: "Every villain phase it adds " },
    { kind: "term", id: "threat", label: "threat" },
    { kind: "text", text: " to the scheme." },
  ]}
  .tips=${{ threat: { heading: "Threat", body: "Pressure toward the scheme. (RRG p. 1)", linkLabel: "Rules glossary ▸" } }}
  @mc-term-glossary=${(e) => openRules(e.detail.heading)}
></mc-term-text>`;
```

A mouse over a word opens its tip and leaving word and plate closes it; a tap, or Enter on its stop, toggles it; a press elsewhere closes it. The open term is the element's own state; `closeTip()` closes it and says whether one was open, for Escape. Compose `mc-dotted-term` and `mc-term-tip` (both defined by the ui entry). A term with no tip is plain words. Size the words with `--term-size` (14px).

## Properties

| Name          | Type                         | Meaning                                          |
| ------------- | ---------------------------- | ------------------------------------------------ |
| `runs`        | `McTermRun[]`                | The sentence: text, terms and breaks.            |
| `tips`        | `Record<string, TipContent>` | The tips by term id.                             |
| `stop-prefix` | string                       | A term's stop key starts with this (`term:`).    |
| `link-stop`   | string                       | The open tip link's focus stop key (`tip-link`). |

## Events

- `mc-term-tip-change` (bubbles, composed): `{ id }`, the open term or null.
- `mc-term-glossary` (bubbles, composed): `{ id, heading }`, the tip's glossary link was pressed.

## Slots

None.
