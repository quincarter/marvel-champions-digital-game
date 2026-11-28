# mc-briefing-page

The campaign Briefing as one page element. It composes sections and nothing else: the box art faded across the page, `mc-top-bar`,
`mc-briefing-speaker`, `mc-briefing-pool` or `mc-briefing-handled`, the issue sections (`mc-briefing-scheme`, `mc-briefing-mission`,
`mc-briefing-shield`, `mc-briefing-easier-start`), `mc-briefing-call`, `mc-briefing-decks` on the coloured pane with its paper panel,
`mc-briefing-modes`, `mc-briefing-watch-strip` (phone), `mc-briefing-action-bar` and, over everything while `model.seatPicker` is
set, `mc-briefing-seat-picker`. Each section's define file is imported once, here. Layout is CSS flow, grid and flex with native
scrolling: a phone is one scrolling page (the story, then the coloured pane across its foot); a wide screen is the left column
(scrolling on its own) and the right pane flush to the right edge. While the call scrolls itself (role-building) the page and the left
column do not scroll.

The scene mounts it with `mountElement`, builds `model` from its state (`scenes/campaign/briefing/page-model.ts`) and handles the
`mc-briefing` events that bubble out of every section (`BriefingDetail`, `components/briefing/briefing.types.ts`).

| Property | Type                                     | Notes                               |
| -------- | ---------------------------------------- | ----------------------------------- |
| `model`  | `BriefingPageModel \| null`              | rebuilt by the scene on each change |
| `phone`  | `boolean` (reflected from `model.phone`) | the arrangement the CSS keys on     |

`scroller` and `scrollers` give the scrolling parts the stick and the page keys move; `takeFromInspect(optionId)` forwards a card
chosen in the Inspect sheet ("Take this card") to role-building.
