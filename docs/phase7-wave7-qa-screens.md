# Phase 7 wave 7 rules-QA: browser pass over the new screens and prompts

`rules-qa-engineer`, 2026-10-07, branch `feature/wave-7`. Every screen and prompt below was driven with real pointer
(1440) or touch (390) input and the screenshots were read. Specs: `packages/client/e2e/wave7-screens.spec.ts` (A-E, 26
passing, 5 `test.fixme`, about 9 minutes serial, every test under 50 s so the gate's workers spread them) and
`packages/client/e2e/wave7-full-game.spec.ts` (F, runs only with `E2E_FULL_GAME=1`: 4.4 minutes for both sizes). New
fixtures: `src/store/dev-qa-screens-game.ts` (+ its Vitest check). Screenshots: `/private/tmp/claude-501/-Users-quincarter-Documents-Dev-marvel-champions-game/144e988e-5813-49ba-b244-097ac3ae5667/scratchpad/screens/`
(`-d` is 1440, `-p` is 390). No console or page error in any run. Not run: the CPU-throttled pass (`E2E_CPU_THROTTLE=4`).
Situation tips were not exercised in a browser beyond the tip lines inside the lessons.

## Fix pass (2026-10-07)

Fixed after the pass, each with a Vitest test (and the e2e tests above no longer `fixme`): Cable's off-screen ring (the guide
scrolls the sideways hand to the card, once per step; `view/guide-anchor.ts` `anchorOffScreenX`, `scenes/board/guide-mount.ts`),
the Try-it exit (the complete panel offers "Back to lessons", "Lessons" on the phone strip, beside "Keep playing"; a lesson save
(`SaveMeta.guided` aspect or mechanic) is left out of Git Gud's previous-game fact, unlock progress, Extras progress and the
results history), Angel's `FORM ×2`, Psylocke's stacked opening hand (no Directed Force or Upside the Head), the dev route
accepting every guided aspect, the glossary cites (`rulebook` and `owner-ruling` source kinds), the stack panel's words
(`view/trigger-event-words.ts`, exhaustive over the engine's event kinds), Game Over's debrief (leads with the loss reason, the
threat count only for a scheme loss, a card-text win reads "The players win"), the restricted-discard line (from
`prompt.limit`), the defense lockout (hand cards tagged "locked out", the defend sheet names them, the villain-phase walkthrough
folds a played "(defense)" card into its defender line), the intro crop (one whole-page beat), and Break Time's sheet title
("On a break"). Left: the spend sheet listing the card being played (engine), the Healing Factor decision under the villain
phase panel (fixme kept), and the Break Time sheet's "select 1" line (drawn in `scenes/choice.ts`).

## Summary

Nothing blocks play. Five items show wrong information (cite wording, a raw engine id, a payment list that offers the card
being played, a Game Over "where it went wrong" line, a "nothing playable" line), the rest is rough.

## A. Try-it lessons (Psylocke, Angel, Cable, X-23, 'Pool): pass, 10 of 10 played to "complete" at both sizes

Each step's ring sits on a control that exists; copy is unclipped and readable. Findings:

- Rough, **Cable "The limit is one" at 390**: the ring is on Build Support, which is off the right edge of the sideways
  hand (ring at x 499-600 on a 390 screen); the callout arrow points at another card and the text never says to scroll.
  `a-cable-limit-p.png`. Owner: phone hand lane and guide anchor (`scenes/board.ts`, `guide/`). Pinned: fixme.
- Rough, **Angel at 390**: the Flip control reads `CHANG… ×2` (truncated). `a-angel-to-archangel-p.png`. Owner: board action bar.
- Rough, **how a lesson ends**: the completion panel only has Close; the way out is Menu, Concede, "Yes, concede", which lands
  on `DEADPOOL CONCEDED` / Run it back, not on the hub. `a-pool-after-leaving-p.png`. Owner: `guide/start-*-tryit.ts`. Pinned: fixme.
- Rough, **Psylocke attack**: after the Psi-Energy Control sheets the attack also opens "Directed Force: trigger an ability?" and
  "Upside the Head" with its pay sheet; the step's tip only mentions Psi-Energy Control. `attack-sheet3-d.png`. Owner: lesson copy.
- Rough, dev only: `?screen=aspect&aspect=pool` opens Justice (`scenes/boot.ts` `valid` set). Pinned: fixme.

## B. New in NeXt Evolution page and glossary: pass

Twelve entries open the Rules reference on that entry (no `[[...]]`, no camelCase ids, both sizes); "Also a Core rule" opens the
Core page and "Added with NeXt Evolution" comes back. The page title draws `NEW IN NEXT EVOLUTION` (the display face loses NeXt's
capital X; cosmetic).

- Wrong information, **the cite** (`actionsOtherTurns`, `b-entry-actionsOtherTurns-d.png`) reads `RRG 1.8 PP. 6, 34 · OWNER
DECISION, NEXT EVOLUTION SPEC 4.1 (2026-10-05) (CARD TEXT)`. A player cannot look up "spec 4.1", and `(card text)` is appended to
  every `card` source, so `NeXt Evolution rulebook p. 5 (card text)` is wrong too. Suggested: `RRG 1.8 pp. 6, 34 · Ruling for this
game, Oct 5, 2026`, and `(card text)` only where the source names a card. Owner: `view/rules-reference.ts` line 172 and
  `content/src/schema/glossary.ts`. Pinned: fixme.

## C. Jukebox and music: pass

All 17 new tracks are listed under their titles, each loads into the audio cache and the sound manager, and the Jukebox reports
it playing; no mp3 request failed. Each of the five scenario intros requests its own `.../<scenario>/battle.mp3`; the Board
for Morlock Siege requests its battle track and Game Over requests the outcome track (F). Board starts for the other four were
not separately asserted.

## D. Scenario intros and Finale: pass

Page numbers match (Morlock Siege 8 ... Stryfe 17: the pages show each scenario's own cast). Finale (`seedNextEvolRun "finished"`):
`NOT OVER.`, issues 5/5, rewinds 0, `EXPERT CAMPAIGN UNLOCKED`, plays Hope for Tomorrow; clean at both sizes.

- Rough: intro beat 1 is a generic crop (x 300, w 1200) that cuts printed lettering at the page edges ("ATTACKING TUNNELS! I…",
  "NOW THAT'S WH…"). `d-intro-morlock-siege-1-d.png`, `d-intro-juggernaut-1-p.png`. Owner: `campaign/scenario-intros.ts` `rulebookIntro`.

## E. Prompts not seen before (fixtures in `dev-qa-screens-game.ts`)

- Restricted discard: pass. Third restricted card (Bazooka beside two Katanas) opens `DISCARD TO TWO RESTRICTED CARDS`, three cards,
  select 1; two stay. Rough: no line says which card just came in or why (`e-restricted-prompt-d.png`, `-p.png`), and Back out is offered.
  The "opens with no card entering play" path (a flip) has no fixture; only the Vitest tests cover it.
- Warpath, villain phase: pass. Defender pick, "Use Warpath", choose cards (Ever Vigilant), spend 2 resources, event played.
  Wrong information (needs a ruling): the spend sheet lists Ever Vigilant, the card being played, among the cards to spend
  (`e-warpath-4-d.png`). Wrong information: the stack panel prints `Response window — enemyAttack` (`view/defend-choice.ts`
  `stackRowLabel`, `e-warpath-2-d.png`). Pinned: fixme (raw id).
- Defense between players: pass, with a limit. Rhino's attack on P1 reaches a decision window and Barely a Scratch is never offered
  on any sheet. The browser shows only the seat that must decide, so what P2's hand tile shows cannot be seen there. Wrong
  information: Deadpool's own window says `Play a defense event: Nothing playable in hand right now.` while he holds Barely a Scratch
  (`e-defense-sheet-p.png`); the code comment calls it intended, but it reads as a lockout. Owner: `view/defend-choice.ts`.
- "Would" replacement (Regeneratin' Degenerate, seed 5): pass. Nothing to click; round 3, `WADE WILSON`, HP 1/9, alter-ego, game
  continues (`e-replacement-after-p.png`). Seeds 3, 4, 9 and 13 lose to the scheme the same round because the replacement adds threat.

## F. Full game in the browser: pass (it plays to Game Over and back), and the game was a loss

Deadpool 'Pool precon vs Morlock Siege, standard, seed 6 (the headless pairing that won), simple policy. Desktop 81 s, phone 139 s,
round 3, 43 commands, same game both sizes: `ARCLIGHT WINS THIS ONE`, final blow Mutant Massacre (no Morlock allies in play,
the Morlocks died to Arclight's attack). The loss track (`Teeth in the Tunnel`) was requested, Back to title reached Title, no error,
no stall. My policy does not defend, so it is not evidence about winnability.

- Wrong information: Game Over's "Where it went wrong" says `R2 The heaviest round for threat: 5 placed, 0 removed` for a loss
  caused by the Morlocks dying. `full-gameover-d.png`. Owner: the Game Over summary (`view/game-over*`).
- Rough, seen once in a first desktop run (not reproduced since): a hero decision ("Healing Factor: trigger an ability?")
  opened beneath the villain phase's "Villain phase complete" panel; its Decline was unreachable until Continue was pressed.
  Pinned: fixme in `wave7-full-game.spec.ts`.
- Unconfirmed: on the phone two plays did not register within 20 s (the driver skipped them); the same plays worked at 1440.

## Counts

26 passing and 5 fixme in `wave7-screens.spec.ts`, plus 1 fixme and 2 env-gated passing tests in `wave7-full-game.spec.ts`.
