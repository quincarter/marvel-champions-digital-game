# mc-decks-community

A community deck's rail, in the stats pane's place: whose deck it is (a MarvelCDB author's, not an official precon), the aspect
stamps and the status stamp (Tested, or what keeps it from being added), when it was published, the author's notes (a long
write-up scrolls natively, and a cue says so), the MarvelCDB link as words and buttons, and at the foot Check and Add.

| Property | Type                                     |
| -------- | ---------------------------------------- |
| `model`  | `DecksCommunityModel` (`decks.types.ts`) |

| Event      | Detail                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| `mc-decks` | `{ type: "action", action: "stats-check" \| "stats-add" \| "stats-preview" \| "stats-copy-link" \| "stats-open-link" }` |

A problem is never colour alone: the reason leads with a mark. Add is dimmed with the reason as its tooltip while it cannot
add, and still raises its press (the screen says why).

Focus stops: `stats-preview` (narrow layouts), `stats-copy-link`, `stats-open-link`, `stats-check`, `stats-add`.
