# mc-title-notice-bar

The Title's "what is new" strip: a caution tag, the message in the display face and a link, all one press target.

| Property | Meaning                                                              |
| -------- | -------------------------------------------------------------------- |
| `input`  | `TitleNoticeInput`: tag, message, link, short link, optional glyph.  |
| `stop`   | Its focus stop's key (`release-notice`), set by the page.            |
| `action` | What a tap raises (the same key); the page's relay makes `mc-title`. |

Events: `mc-pressed` (`{ action, hold }`). Slots: none. The link shrinks to its arrow below 480px of width.
