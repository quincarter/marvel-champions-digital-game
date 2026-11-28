# mc-term-tip

A glossary definition on an ink plate under (or over) the word it explains, with a link to the rules glossary and an arrow at the word.

## Usage

```ts
html`<p style="position: relative">
  Every villain phase it adds <mc-dotted-term label="threat"></mc-dotted-term>.
  <mc-term-tip
    .anchor=${wordEl}
    heading="Threat"
    body="Pressure toward the scheme. (RRG p. 1)"
    link-label="Rules glossary ▸"
    link-stop="tip-link"
  ></mc-term-tip>
</p>`;
```

It has no backdrop: the text that holds it closes it. Put it inside a `position: relative` box with nothing clipping between it and the page; it places the plate with `tipPlacement` (the aspect tip's rules) in the screen's pixels and measures again on an update, a resize and a scroll. Mount it only while a term is open.

## Properties

| Name         | Type    | Meaning                                  |
| ------------ | ------- | ---------------------------------------- |
| `anchor`     | Element | The word the tip points at.              |
| `heading`    | string  | The term's name.                         |
| `body`       | string  | The definition and its source.           |
| `link-label` | string  | The glossary link's words.               |
| `link-stop`  | string  | The link's focus stop key (`data-stop`). |

## Events

`mc-term-link` (bubbles, composed): a tap, or Enter on its stop, on the link.

## Slots

None.
