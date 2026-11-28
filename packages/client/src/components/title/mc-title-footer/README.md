# mc-title-footer

The Title footer line: the card count note, links (release notes, sometimes Discord) and the build version.

| Property | Meaning                                                             |
| -------- | ------------------------------------------------------------------- |
| `input`  | `TitleFooterInput`: note, version, links with keys, optional aside. |

Each link is a focus stop (`data-stop` = its key). Events: `mc-pressed` with the key as the action. Slots: none. The note
hides below 440px of width.
