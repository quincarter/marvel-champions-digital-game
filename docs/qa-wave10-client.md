# Wave 10 client QA, second pass (progression, two seats, builder, phone pay bar, heroes)

Driven in the real client (Playwright against a private Vite dev server, throwaway `zz-qa2-*` drivers, deleted). Desktop 1440x900, phone 390x844 and 360x740, tablet 768x1024. Screenshots: `artifacts/qa/qa-wave10b-*.png` (28 kept). Console and page errors were collected in every run: none. Sizes: **blocker** = a player cannot do something; **should fix** = a player will stumble; **polish** = survivable. Coverage is partial: see "Not covered" at the end.

Permanent test added: `packages/client/e2e/wave10-x-stepper-phone.spec.ts` (`test.fail()`, 390x844 and 360x740; both fail for the right reason: X stays 1 after a tap on "+").

## 1. Progression (fresh profile)

- OK Fresh profile: Title menu is new-game, decks, campaign, extras, how-to-play, settings, release-notes: no "Civil War!" row (01-title-fresh).
- OK After a finished Agents of S.H.I.E.L.D. campaign (`__mcCampaign.seedAos("finished")`, reload): the row is there, directly after Campaign (02-title-after-aos). Champion points read 500 (Unlocks, d06-unlocks).
- OK Unlock model after that: Tigra and Hulkling open (`heroLock` null); Wonder Man reads "Beat Iron Man (Registration: Iron Man) to unlock Wonder Man"; Hercules reads "Beat Captain America (Resistance: Captain America) to unlock Hercules". Before the campaign all four read "Complete the Agents of S.H.I.E.L.D. campaign to unlock Civil War".
- OK Built and imported decks are never locked (`Unlocks.deckLock` returns null for a non-precon): read from the model, not played.
- OK Seats shows Wonder Man dimmed with a LOCKED stamp and the lock line (d05-seats-WonderMan, p05-seats-WonderMan).
- **F1, polish (question for the owner). Scenario select on a fresh profile still has a "Civil War" chip** (d03-select-fresh) beside the other locked boxes. The brief expected it absent like the Title row. Every other locked box is listed the same way, so this is consistent; the chip's tiles carry the hint (`wave10-civil-war.spec.ts` asserts it). Decide whether "absent on Title, locked on the shelf" is intended.
- **F2, polish. The lock line is clipped and doubles the name.** "BEAT IRON MAN (REGISTRATION: IRON MAN) TO UNLOCK WONDE..." on desktop and phone (d05, p05): the player never reads "or N pts". Fix in `UnlockHero` text (`progression/unlocks.ts` `heroHint`, `villainLabelOf`): use "Beat Iron Man" for the two leaders, or let the tile wrap to two lines (`scenes/seats.ts` around line 1288).
- **F3, polish. The Unlocks screen has no row for Civil War as a box** (campaign list ends at Vol. 9, d06-unlocks): correct (the box has no campaign); the By wave list below it was not scrolled to.
- Not checked: the winning of Iron Man / Captain America unlocking Wonder Man / Hercules through a saved win (the staged wins below are in a dev host that saves nothing; `unlocks.test.ts` covers the rule). Champion points for the four scenarios: not checked. "New in Civil War" page and the progression guide text: not re-read (first pass saw the page).

## 2. Two seats (hot-seat)

- OK Two minions on two heroes are labelled: "VS WONDER MAN" and "VS HERCULES" above each card on desktop and phone (d31-two-board, p32-two-enemies). Sandman and Hercules's own nemesis Ares were engaged by the round's two encounter cards.
- **F4, polish. The desktop label truncates a long hero name**: "VS WONDER M..." (d31). The tab is as wide as the card (about 85 px). Phone shows the whole name.
- OK Hot-seat privacy: an encounter-deck search for seat 1 shows "Only Tigra may look. Tap to reveal" over the card area (d10-two-seat-start), and the sheet says "ENEMY TEAM'S CHOICE · As first player, you choose for the enemy team" quoting p. 6.
- **F5, polish. Inconsistent hero naming on one sheet**: the sheet header says "Greer Nelson ALTER-EGO", the cover says "Only Tigra". Pick one (the identity's player-facing name) in `scenes/choice.ts`.
- **F6, polish. That sheet is titled "IRON MAN: CHOOSE CARDS"** (d10) for the leader's Setup search of the encounter deck; the choice is "find an Iron Man attachment". The title could name the search.
- OK Team-Up: Hercules and Thor flipping to hero shows the "TEAM-UP: HERCULES AND THOR" splash with its own picture (d80) and, afterwards, the ring on the panel and the TEAM tab marker on the phone (p81).
- OK Leader per-player hit points and threat with two seats: "HP 24/24" and threat "4 / 14" at the start (d10); the numbers are 12 per player and 7 per player, as the scenario says.
- Facedown encounter cards "FACEDOWN n" with an owner: not reached (no scheme in the staged rounds dealt a facedown card to each seat).
- Coordinated Effort resource help and the consent walk are in `coordinated-effort.spec.ts` (desktop, existing). "Who takes the damage?" (a damage, deck-discard, random-discard or encounter-card cost part): **not reached**. It needs Coordinated Effort (58032, "attach to an encounter card in play") on an encounter card whose action has such a cost, and a second seat as helper. The pool has encounter cards with `takeDamageCost` (the Wrecker, Bulldozer, Thunderball sets, Kang's set), but I did not stage one, so this is untested on screen, not impossible.
- Swordsman defending for the other player: **not reached**.

## 3. Builder beyond the happy path

- OK Expert in the builder: leader "stage III", "Encounter set: Expert", "Expert uses leader stages III and IV", Difficulty: Expert in the summary (b40-short-step5). Stages III and IV played: not played (staged wins below were standard).
- OK Switching side after four sets were picked: the leader, stages and sets all become the other side's, four recommended sets, counter reads "3 to 4 sets. Chosen: 4" (b41-tab-after-side-switch). The earlier hand-picked sets are dropped without notice: polish, by design.
- OK Set tiles at the cap: "4 of 4 chosen", dimmed, no padlock (the first pass's F6 is fixed) (b40-tab-step4).
- **F7, polish. The builder's subtitle reads badly**: "Iron Man, Cut Off Support then Negative Zone Prison, 4 modular sets chosen of 3 to 4." (b40-tab-step4, b41). "4 modular sets (3 to 4 allowed)" reads as English. Lives in `view/civil-war-builder-model.ts` (the heading's summary line).
- OK Tablet portrait (768x1024) steps 4 and 5 and short phone (360x740) steps 4 and 5 draw without clipping; the step rail becomes the 1 to 5 tab strip at the foot on the phone (b40-short-step4, step5).
- OK Random and blind: the Table setup, Pause and the board named no hidden set before it turned up, in two games (config sets read from the store, every visible text compared, rounds 1 to 4; the hidden set appeared by name only after one of its cards was out). Pause's scenario sheet showed no set names (b53-blind-pause).
- OK A blind game that is lost shows no hidden set on Game Over; it did name "Secret Avengers" as the final blow, which is stage 2 of that game's main scheme after the scheme had advanced.
- Not checked: the Full game log in Pause, the save label and resume of a blind or custom game, "Play again" / "New random scenario" from Game Over, Back from every step, keyboard and gamepad order through the set sheet and Inspect, three sets against four, another product's set, "Random then editing".

## 4. Pay bar at phone width

- **F8, BLOCKER (pinned by `wave10-x-stepper-phone.spec.ts`). The X stepper's "+" is drawn under PAY at 390x844 and 360x740, and a tap on it does nothing** (p21-390-x-bar, p21-360-x-bar). The bar shows "- X 1 PAY CANCEL" with no plus; `xMore` is a 44 px rect at x=250, exactly where PAY is. Everywhere All at Once (and any X card on a phone) can only be played at its least X. At 360 the "X 1" label is also cut off by the "-" and PAY buttons. Fix in the payment bar's layout (`scenes/board/` payment bar; `xLess` and `xMore` rects): give the stepper its own row on phones. No CI spec ran the stepper on a phone (the phone project does not list `x-cost.spec.ts`).
- **F9, should fix. Mr. Hollywood's overpay-only tile on the phone says "OVERPAY..."** (clipped, with a "+1E") and the "Only to overpay" lock note is not on screen at all (p20-390-hollywood-only, p20-360-hollywood-only). A player taps the tile and nothing happens with no reason given. The desktop text is there (`wonder-man-overpay.spec.ts`).
- **F10, polish. The subject card in the phone pay strip reads "PAYING FOR"** over the card art with its name hidden at 390 (p20-390-eaao-x): say which card.
- OK The bar's headline "PAYING 0 / 1" and CANCEL fit at both widths.
- "Play without overpaying" on a phone: **not reached** (the tap on the cost-0 card failed to open Inspect twice under the driver; a driver problem, not run again). Payment-order tags, the Hunted sheet with 1, 3 and 6 candidates, the discard sheet with 5 to 12 cards: not run (the Hunted and discard sheets are covered at phone width by their own existing specs).
- `orderKeywords` choice tiles: **cannot be staged with real cards**. The engine asks only when a revealed minion has both Quickstrike and Teamwork and the Teamwork condition is met (`resolve/reveal.ts` `stepRevealKeywords`); no minion in the card data prints both keywords (searched `cards.ts` in every data folder). Only the tiles' view-model test exists.

## 5. Heroes and leaders

- OK Wonder Man staged hand: Signature Sunglasses and Jet Belt played with the engine's example payments, no prompt came up, the log read "You played Jet Belt for 2." Not reached: tuck to 3 and the refused 4th, Sunglasses's two options, "What Are You?" on defeat, Pacifism and Brother vs. Brother (the codes 58025 and 58027 are not in his starter deck; the stack refuses them), Energy Siphon (an event, not playable without an attack).
- OK Wins: Iron Man, Captain Marvel, Captain America and Spider-Woman each reached Game Over by a staged win in a dev host (the leader's damage set to 200, a basic attack, twice for stage I and II). Title reads "<LEADER> DEFEATED", "STAGE II CLEARED", "HEROES DOWN 0 OF 1" on a flat green screen (w60-0-registration-iron-man, w60-3-resistance-spider-woman).
- **F11, polish. The leader-loses Game Over has no picture.** Defeats show a full-bleed leader picture; the win is a flat green field with large empty space under one dark box (w60-0). The first pass noted the same large black box for a loss. If a win is meant to carry the hero's or the leader's art, it is missing.
- **F12, polish (staging artifact, not a game bug). "Run it back" and "Same seed, same hands" are greyed on a dev-hosted win**, and "0 damage dealt to Iron Man" is a result of how the damage was set. Not a finding for real play.
- Hercules, Tigra and Hulkling signature cards: Hercules's panel in two seats showed "GIFT CARDS COUNTED: 0", "WRONG FORM" tags on alter-ego-only cards and "GIFT CARDS: 0" at the foot of Gift cards (d31-two-board). The three Labor cards, Atonement, Appeal to Athena, Olympus and Prince of Power: not played.
- Unlock on the right win (Wonder Man for Iron Man, Hercules for Captain America): not shown on screen, see section 1.

## 6. Guided mode and reference

- OK Glossary data for Quickstrike says the attack comes after When Revealed and carries a player note about the earlier ruling (`content/src/schema/glossary.ts`), read from source only.
- Log wording: read in source, not seen on screen: "paid <card> with ...; ... overpaid", "<helper> helps pay for <card>: the damage" (Coordinated Effort), Labor to the bottom of the deck (`returnedToSeparateDeck`). An X chosen has no log line of its own in `log-lines.ts` (the card's own effect says what happened); the play line did not show the X in the staged Jet Belt log. Not run on screen for Everywhere All at Once.
- Try-it lessons at phone width, glossary entries on screen, Inspect notes: not covered.

## Tool notes

- Staging that worked: `store.start({ ..., stack: { players: {0: [codes]}, encounter: [...] } })`; `__mcCampaign.seedAos("finished")` then reload for the box; `DevStateHost` plus `useDevHost` to put a leader one hit from defeat (the Board must be restarted after it, or it keeps listening to the old store).
- A game started with a card in the stack that is not in the deck fails silently to the player's eye (no `game` in the store, black screen): `setup failed: stack puts 58025 on top of p1's deck more times than the deck holds it`. A dev-only problem.

## Count

About 60 things checked (OK 34, not reached or not checked 26). Findings: 1 blocker (F8), 1 should fix (F9), 10 polish or question (F1 to F7, F10 to F12), 0 console or page errors.
