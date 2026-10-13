# QA of v0.20.0 in the browser (client side)

Driven with Playwright against a private dev server (Chromium, GPU). Sizes: desktop 1440x900, tablet 1024x768, phone
390x844, small 360x740. Games were real (`store.start`, with a stacked hand where a card had to be in hand). Screenshots
are in `artifacts/qa/qa-v0200-*.png`. Page errors and console errors were collected throughout: none came from the game
(the only console lines were the browser's own "Failed to load resource" for the stubbed offline and 403 answers, and
the autoplay AudioContext warning).

F1 to F3 are pinned with `test.fail()` in `packages/client/e2e/qa-v0200-client.spec.ts`. Delete each marker when fixed.

## Findings

### F1. X stepper's "+" is under the Pay button on a phone (should fix; blocks naming X on phones)

Screenshots: `qa-v0200-pay-phone-picked-4.png`, `qa-v0200-pay-small-picked-4.png` (tablet is right: `qa-v0200-pay-tablet-picked-4.png`).
At 390 the pay bar shows "-", "X 1", then PAY; the "+" is not visible. The `xMore` focus rect (x 250..294) sits inside Pay's rect, so a
tap raises nothing. At 360 Pay also cuts the "X 1" label. A phone player cannot name an X above the minimum
(Everywhere All at Once, any X card). Pinned (phone viewport). Fix: the payment bar layout in `scenes/board/` (where the `xLess` / `xMore` rects are placed): stack the stepper on a second row or shrink the prompt on narrow widths.

### F2. Z (and a click on Undo) with a payment open cancels the payment and also takes back the move before it (should fix)

Screenshot: `qa-v0200-undo-desktop-after-z-in-payment.png` (Mr. Hollywood, played before the payment, is back in hand).
A player who played Mr. Hollywood, opens a payment for another card and presses Z to back out loses Hollywood too (trail 3 to 2).
The Undo button stays enabled while the payment bar is open. `BoardController.undo()` sets the selection idle, then rewinds the last move; the payment bar has its own Cancel.
Fix: `undoOffer()` / `undo()` in `scenes/board/controller.ts` should offer nothing (button greyed, Z ignored) while `selection.kind` is `paying`, or Z should only close the open mode. Pinned.

### F3. Undo's reason is never shown (should fix)

Screenshots: `qa-v0200-undo-desktop-hover-disabled.png`, `qa-v0200-undo-small-initial.png`.
`view/undo.ts` gives four reasons ("Nothing to undo this turn", "Can't undo: new cards were drawn or seen", "...another player's move", "...past the start of the turn"),
and `action-bar.ts` passes it as `McButton.reason`, but nothing draws `McButton.reason` (no tooltip, advisory line or toast).
The player sees a greyed button and a silent press; Z does nothing and says nothing either. This answers "what is the player told when Undo stops": nothing.
Fix: draw the reason on hover/focus and on a press of the greyed button (the action bar's advisory line is the nearest slot). Pinned.

### F4. Payment order tags never appear on a 360 px phone, and the "why the top card matters" note is unreachable on touch (should fix)

Screenshots: `qa-v0200-pay-small-picked-4.png` (four picked cards, no tags), `qa-v0200-pay-phone-picked-4.png` (tags fine at 390).
`scenes/board/hand.ts` draws the tag only when `slot.width >= 70`; tiles at 360 are narrower, so numbering and "on top" vanish with no other cue.
The note is wired to hover only; a touch tap toggles the pick, so a phone player never reads `ON_TOP_NOTE`. Fix: put "discard order 1, 2, 3 (last on top)" in the payment bar text at narrow widths, and the note in Inspect or on a long press.

### F5. Update banner cannot be dismissed (polish)

Screenshots: `qa-v0200-update-small-long.png`, `qa-v0200-update-tablet-long.png`.
`scenes/title.ts` has no dismiss and no "seen this version": the banner returns on every Title visit and launch until the player updates.
At 360 the banner sits tight on the "DIGITAL EDITION" label. Fix: a small close that stores the dismissed version.

### F6. Defend sheet: the arrow runs through "+1 BOOST" at 360 px (polish)

Screenshot: `qa-v0200-defend-small.png`. The "+1 BOOST" caption under BASE ATK is struck by the arrow to the defender. The option cards are fine (no text past the foot at any size). Fix: the attack header layout of the sheet.

### F7. A picked payment tile loses its helper / overpay tag (polish, from code)

`drawPaymentTable` in `scenes/board/hand.ts` swaps a picked tile's tag ("Ana", "overpay only") for "spent N", so after the pick you cannot tell whose card it is.
Tiles with an amount note ("take 2 damage") keep the note and get no number, so the two never overlap, but those picks are not numbered. Not seen on screen (no helper game driven).

### F8. A rapid double press of Undo takes back two moves, and nothing says an undo happened (polish)

Screenshot: `qa-v0200-undo-desktop-after-double.png`. Two form flips, two quick clicks: both gone, log back to "You take a turn." State is consistent, no errors, but a fat finger loses two moves
with no toast or log line. Fix: a short debounce and an "Undid: ..." line.

### F9. Small copy and layout (polish)

- Duplicating a deck repeatedly grows the name ("... (copy) (copy) (copy) ...") and the status line fills the left rail, leaving six deck rows (`qa-v0200-decks-desktop-many.png`). Fix: number the copies.
- Hercules' Labor pile caption "IN PLAY: EMBODY PAT..." is truncated (`qa-v0200-crowd-desktop-13-end.png`).

## Checked, OK

Undo (item 1)

- OK Undo sits between the basic powers and End turn at every size (desktop 1134,848 110x36; tablet 718,716; phone and small on End turn's row, left, 46 high).
- OK Greyed with no moves; Z with nothing to undo changes nothing (version unchanged).
- OK Flip then Z puts the form back; the log shows no ghost line; hand, counters and tiles match; reload and Continue after an undo keeps the undone state.
- OK Triple Z on one move undoes one move only.
- OK Z with Pause or Inspect open does nothing (blocked); no stuck focus.
- OK Right after Continue from a save: Undo present, greyed, Z does nothing.
- OK Two-seat hot-seat: seat 2 starts greyed, Z does not undo seat 1's flip; seat 2's own flip undoes alone.
- OK Try-it lesson (Wonder Man): Undo and Z are inert (guide gate), step tracking undisturbed. The button looks enabled in a lesson (see F3, no message).
- OK Focus order puts Undo before End turn only when idle (`view/focus.ts`); it is not in the paying order.
  Payment tags (item 2)
- OK 1, 2, 3, 4 picked at desktop, tablet, phone: "SPENT n", the last "SPENT n - ON TOP" (wraps to two lines inside the card on phone).
- OK Unpick the first: the rest renumber; repick: it goes to the end and takes "on top".
- OK Desktop and tablet hover note appears above the on-top card, clamped on screen.
- OK X stepper changing X to 4 does not disturb the tags (desktop, tablet). "overpay only" tag shows before the pick and is not overlapped.
  Update banner (item 3)
- OK Browser (no Capacitor or Tauri): no request to GitHub, no banner.
- OK Offline, 403, malformed HTML, wrong-shape JSON, a release with no APK: no banner, no game error.
- OK A version of 12345.6789.1234567 fits at all four sizes; Continue, Campaign, Civil War! rows stay clear.
- OK Link targets (release notes, direct APK) match the repo; `parseLatestRelease` drops any URL outside the repo.
  Decks (item 4)
- OK "+ New deck" stays put with 0 and with 31 decks on desktop (y 89), and is in view at tablet, phone, small (102x44).
- OK Play this deck, back, back lands on Title and stays: Wonder Man, Hercules and a community deck copy.
- OK Duplicate is 103 to 231 wide x 52 at every width, display face (`qa-v0200-decks-small-stats.png`, `qa-v0200-decks-tablet-stats.png`).
  Crowded play area (item 5)
- OK Desktop, Hercules with a Labor in play and the Labor and Gift piles, 13 cards: wheel scrolls 0 to 601, cards stay readable, piles stay clear, scroll position survives a state update and an Undo.
- OK "GIFT CARDS COUNTED: 0" on the identity.
  Defend (item 6)
- OK Warpath fixture at all four sizes: no text past the foot of any option (3 options).
  Links (item 7), by reading
- OK Every external open goes through `openExternal` (`platform/platform.ts`): `scenes/title.ts` (release notes, banner), `scenes/decks.ts` (MarvelCDB), `scenes/extras-reader.ts` (rulebook PDFs). No `window.open`, `target="_blank"` or anchor navigation elsewhere (`save-data/file-transfer.ts` makes an `<a download>` for exports only). The Tauri allowlist (`src-tauri/capabilities/default.json`) covers github.com/quincarter/marvel-champions-digital-game/* and marvelcdb.com/*, which include the tag and download URLs. Capacitor relies on `window.open(_blank)` reaching the system browser (not tried on a device).

## Not covered

Campaign game Undo; Undo with the Hunted sheet, the cost-help prompt and consent walk, the overpay-only lock; payment from a helper's hand and its pile order; tags beside "take 2 damage" notes; 5 or more picks on a phone; tablet and phone crowded play area (a stuck Inspect sheet blocked the wheel in the one run, so desktop only); keyboard focus scrolling a hidden card (25 Tabs did not move the row from its end: inconclusive); 1 to 6 defenders, long defender names, an ally at 1 HP, Swordsman's response, Herc's Helm; a Labor card on a minion and Ionic Physiology with tucked cards in a crowded row; the desktop-app open path and a real update install.
