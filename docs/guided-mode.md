# Guided mode

Owner: `game-client-engineer`, with `game-rules-architect` for the engine setup primitive (G1).

This is the plan for PLAN.md's "Tutorial/onboarding flow for players unfamiliar with the paper game". It covers a
guide level the player picks (Full / Hints / Off), a scripted first game, hint warnings before costly mistakes,
glossary tooltips, a round debrief, and a Settings entry for all of it. If you land or change a workstream, update
this file in the same change and tick its box in §4.

Started 2026-09-26 on `claude/guided-mode-designs-491431`.

## 1. Sources

**Designs** (rendered tiles, no `.dc.html` source in the repo):

- `artifacts/design-screenshots/individual/guided-phone.dc/`: P01 choose guidance, P02 how to win, P03 spotlight
  threat, P04 paying for cards, P05 villain phase, P06 safety net, P07 debrief.
- `artifacts/design-screenshots/individual/guided-tablet.dc/`: T01 choose guidance, T02 paying for cards (guide side
  panel), T03 safety net.
- `artifacts/design-screenshots/individual/guided-desktop.dc/`: D01 threat lesson (guide side panel), D02 villain
  phase, D03 debrief.

**The designs are intent, not pixels** (owner, 2026-09-26: "The designs don't fit our UI exactly. Use your best
judgement"). Take from them the content, the order, the hierarchy and the guide's visual voice: a yellow guide surface
(`GUIDE` stamp, Bangers title, body text, one ink primary action), a yellow spotlight ring on the thing being taught,
a `TRY THIS` tag on the card or button to use, and a `GUIDE PICK` tag on a recommended choice. Build all of it from our
existing board, overlays, tokens and `Mc*` widgets. Don't restyle existing screens to match a guided tile.

**The designs' game content is placeholder.** They show Crossbones, Spider-Woman, Hawkeye, Venom Blast and a 12-threat
scheme. The tutorial is Core Set Rhino with Spider-Man (owner decision, §3). Every number on a guide surface comes
from the engine or `@mc/content`, never from the tiles. The tiles' "Energy: counts as 2 resources" is also wrong in
general. Energy gives 2 only when paying for an Energy card.

## 2. Ground rules

The phase 4 ground rules apply unchanged ([phase4-screen-gaps.md §0](phase4-screen-gaps.md)).

- **The guide is a view, never an authority.** It reads store state and events, and it only ever issues ordinary
  commands through the controller. Nothing about the guide reaches `@mc/engine` except G1's setup option, which is
  part of the replayable setup config.
- **Advice uses only visible information** (`view/visibility.ts`). Examples: "Rhino could attack for 2" is fine. "The
  boost card is a 3" is a leak. Every hint is a named heuristic in a tested view model, worded as a suggestion
  (phase4-screen-gaps.md §4, "Advice text").
- **Heuristics live in plain TS view models with Vitest tests.** Scenes stay thin.
- **The guide is local to one client.** It is not synced, and it's never shown to other seats. The tutorial game is
  solo.
- **Glossary wording is a short paraphrase with an RRG 1.8 page cite**, the same as the keyword glossary.

## 3. Decisions

1. **Tutorial matchup: Core Set, Rhino, standard (I→II), solo Spider-Man (`core-spider-man-justice`)** (owner). Rhino
   is the easiest villain. Spider-Man is unlocked from first launch. His THW is good, and his precon is Justice, which
   the thwart lesson suits.
2. **Predictability: fixed seed plus stacked decks** (owner). The engine gets a replay-safe setup option (G1) that
   puts named cards on top of the player deck and encounter deck after the seeded shuffle, so a game rebuilt from
   `{seed, setup, commands}` replays exactly. Test-only state edits (`putOnTopOfDeck`) are not used, because they
   break replay.
3. **Scripted lessons for the core loop, opportunistic tips for the rest** (owner: "a happy mix"). The five lessons
   are staged by the stacked opening. Everything else (§5.3) fires the first time its situation happens, in any game,
   at the Full level.
4. **The lessons are reordered from the tiles to follow the real rules.** A hero starts in alter-ego form (RRG
   setup), and _The Break-In!_ starts at 0 threat, so round 1 has nothing to thwart. The five lessons are How to win,
   Hero & alter-ego, Paying for cards, The villain phase (round 1), and Threat & thwarting (round 2). See §5.1.
5. **Safety net and "Confirm before end turn" stay separate** (owner). The existing confirm still catches unused basic
   actions. The guide's warnings are about losing the game. Each warning has its own "Don't warn me about this again",
   and Settings lists the silenced ones so they can be turned back on.
6. **Hint triggers** (owner): the scheme will complete, lethal damage incoming, a flip into danger, a wasted payment.
   §5.2 has each heuristic.
7. **Aspect tips** (owner: "tips for every Aspect so someone will know the benefits of each one"). Each aspect gets a
   short, original tip card with what it's good at, its play pattern and a signature example card from the Core Set.
   Tips cover Aggression, Justice, Leadership and Protection, plus Basic, and Pool once it's in the playable pool. They
   show in hero and deck selection, and at Full level the first time a card of that aspect is drawn.
8. **Guide prefs persist in `localStorage` (`mc-guide`, versioned)**, copying `progression.ts`'s read/write pattern
   (fall back to defaults when storage throws). Other settings stay in memory. Persisting all settings is out of scope
   here.
9. **The first-run chooser shows on first launch** (no `mc-guide` record), after Boot and before Title. It stays
   reachable from Settings ("Guide" group → "Play the tutorial") and from Title. Choosing a level writes the record, so
   it never shows again unprompted.
10. **Lesson steps gate softly.** During a "do this" step, the taught control gets the spotlight and `TRY THIS`. Other
    controls are dimmed and inert until the step completes, but "Skip lesson" and the menu are always live. Skipping
    ends scripted lessons for this game and drops to Hints.
11. **Tutorial progressive unlocks** (tiles D01/D03). The Log tab and the Log chip unlock after lesson 5. They stay
    visible, dashed, with "Lesson 5" as the reason. Flip is taught in lesson 2, so it's live from the start.

## 4. Workstreams

Run one agent at a time in the session worktree. Each is one primitive or one screen. Ask every agent for handoff
notes (files touched, what it left for the next one).

- [ ] **G1 Engine: stacked setup (`game-rules-architect`).** Add a replay-safe option to `GameSetupConfig`:
      `stack?: { players?: Record<number, readonly CardId[]>; encounter?: readonly CardId[] }`. After the seeded
      shuffle, it moves those codes to the top of that deck, in order. Also thread it through `coreScenario`
      options and client `SessionConfig`. Tests: replay from `{seed, stack, commands}` is identical, a missing code
      is a setup error, and `undefined` changes nothing.
- [ ] **G2 Guide prefs + Settings entry.** `guide/guide-prefs.ts` (level, `chooserSeen`, tutorial progress, silenced
      warnings, seen tips) persisted as `mc-guide` v1. A segmented Settings row for Guide level (Full / Hints / Off),
      "Play the tutorial", and one toggle per silenced warning ("Warn before the scheme completes", …). Shared
      between the Settings overlay and Pause's inline group through `view/settings-rows.ts`.
- [ ] **G3 Glossary basics + tooltip.** Add basic-concept entries (threat, main scheme, acceleration, thwart,
      resource, cost, hero/alter-ego, flip, recover, exhaust, defend, consequential damage, encounter card, boost,
      villain phase) with RRG 1.8 cites. Build `McTermText`, which is body text with dotted terms, and `McTooltip`,
      a hover on desktop and a tap on touch that shows the term, a one-line rule and "Rules glossary ▸", deep-linking
      to `SCENES.rules`. Terms stay live at every guide level. At Off, they're the only guide surface.
- [ ] **G4 Guide surfaces.** `McGuideCallout` (the anchored yellow callout, phone), `McGuidePanel` (the collapsible
      yellow side rail with the lesson list, step body, tip box, progress, Back and the "do this to continue" slot, for
      desktop and tablet landscape), the spotlight ring, and the `TRY THIS` / `GUIDE PICK` tags. Board layout reserves
      the rail when it's open. Layout tests for no overlap at 1440×900, 1024×768, 768×1024 and 390×844.
- [ ] **G5 Tutorial game + lesson engine.** `guide/tutorial-config.ts` holds the fixed `SessionConfig` (seed, the
      Spider-Man precon, and the stack from §5.1), with a test that plays the scripted commands and asserts each
      lesson's precondition state (the `ALLIANCE_DEV_CONFIG` pattern). `view/lesson-model.ts` is a pure state
      machine: lessons → steps, each step with an anchor, copy, and a completion predicate over store state/events.
      Tests drive it with recorded events.
- [ ] **G6 Chooser + How to win.** P01/T01 "New to the fight?" (three radio cards, Recommended stamp, lesson chips on
      wide layouts, Suit up). Then P02 "One way to win, two ways to lose", built from Rhino/The Break-In!/Spider-Man
      data, with Start the fight and Tell me more (opens the Rules reference). The chooser is wired into Boot → Title,
      and "Learn as you play" routes straight to the tutorial game, past scenario and seat selection.
- [ ] **G7 Lessons on the board.** Wire lessons 2–5 (§5.1) to G4's surfaces: the flip spotlight, the payment lesson
      over the existing payment bar, the villain-phase lesson (the villain-phase overlay's step list plus the
      `GUIDE PICK` on the defend choice sheet), and the thwart lesson with the threat ring.
- [ ] **G8 Round debrief.** P07/D03 at end of round while lessons remain. It shows the lesson checklist, one "Worth
      remembering" line from a tested heuristic over the round's events, "New on your board" unlocks, the guide-level
      segmented control, Replay a lesson, and Round N ▸. Hero art on the wide layout.
- [ ] **G9 Hint warnings (safety net).** `view/guide-hints.ts` has the four heuristics (§5.2). The "Hold on!" overlay
      (P06/T03) intercepts the triggering command the way `end-turn-confirm` does. It offers the safe action first,
      the "anyway" action second, and "Don't warn me about X again". Active at Full and Hints.
- [ ] **G10 Opportunistic + aspect tips.** `view/guide-tips.ts` holds the trigger table (§5.3) and aspect tips (§3.7).
      Each tip shows once (it's recorded in `mc-guide`) as a small callout at the Full level. Aspect tip cards go in
      Seats / Deck check.
- [ ] **G11 QA pass.** A headless click-through of the whole tutorial at 390×844, 1024×768 and 1440×900, with
      reducedMotion both on and off, and screenshots beside the tiles. The main session verifies by clicking before
      ticking anything (memory: verify UI by clicking).

The order is G1 → G2 → G3 → G4 → G5 → G6 → G7 → G8 → G9 → G10 → G11. G2 and G3 touch different files and could run
side by side. Everything else runs in sequence.

## 5. Content

### 5.1 The five lessons

Tutorial game: Rhino standard, solo, Spider-Man Justice precon, `bomb_scare` modular. The stack guarantees the round-1
opening hand and the first encounter cards. G5 picks the exact cards and seed. The cards below are the intent.

| #   | Lesson             | When                        | Teaches                                                                                                                                                                                                              | Stack needs                                                               |
| --- | ------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | How to win         | Before the game (G6 screen) | KO Rhino through two stages. You lose if _The Break-In!_ completes or Spider-Man is defeated. The round loop: you act → villain acts → draw up.                                                                      | —                                                                         |
| 2   | Hero & alter-ego   | Round 1, start of your turn | You start as Peter Parker. In alter-ego the villain schemes, and in hero form he attacks. Flip once per turn. Hand size differs by side. Spotlight the Flip button.                                                  | —                                                                         |
| 3   | Paying for cards   | Round 1, after the flip     | Cost vs resources printed on cards, and discarding to pay. The Power of Justice counts double for Justice cards. Play Black Cat (cost 2): the ally the next lesson relies on.                                        | Black Cat + a 2-resource path in the opening hand                         |
| 4   | The villain phase  | Round 1, villain phase      | Always the same order: threat is placed, Rhino activates, encounter card. Who takes the hit: Black Cat blocks (`GUIDE PICK`), defend yourself (exhaust), or take it. Spider-Sense draws a card when you're attacked. | A gentle first encounter card, e.g. _Advance_ (gives threat for lesson 5) |
| 5   | Threat & thwarting | Round 2, start of your turn | Main scheme threat and target. THW removes threat, using your action like attacking. Rule of thumb: thwart when threat is past halfway. Spotlight the scheme, then Thwart.                                           | Threat > 0 at round 2                                                     |

After round 1's villain phase, the round debrief (G8) shows lessons 1–4 done and lesson 5 up next. After lesson 5 the
last debrief unlocks the Log. The game then continues at the Hints level unless the player picks Full.

### 5.2 Hint warnings (Full and Hints)

Each is a named heuristic in `view/guide-hints.ts` with its own silence key.

| Key            | Fires when                                                                                                                                                                                                            | Safe action first                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `schemeFinish` | Ending the turn, and the main scheme's threat plus the minimum visible threat the next villain phase adds (acceleration + tokens + icons in play + the villain's SCH if the hero is in alter-ego) reaches its target. | "Thwart first −N" when a thwart is legal |
| `lethal`       | Ending the turn in hero form, and the visible attacks queued against the hero (villain ATK + engaged minions' ATK, not counting boost) could defeat the hero with no ready defender/ally. Worded "could".             | "Keep a defender" / "Flip to alter-ego"  |
| `flipDanger`   | Flipping to alter-ego when the villain's SCH plus the step-1 threat would complete the scheme. Or ending the turn in alter-ego with that condition.                                                                   | "Stay in hero form"                      |
| `wastedPay`    | Confirming a payment that overpays (`paid > required`) or spends a card that is itself playable and affordable this turn while another spendable card would cover the cost.                                           | "Change payment"                         |

### 5.3 Opportunistic tips (Full only, once each)

The first time a minion engages, Guard, a side scheme comes out, acceleration, a boost card flips, Stunned or Confused,
the villain changes stage, Retaliate, Toughness, an obligation, a nemesis set, Crisis, Patrol, Surge, Hinder, Quickstrike,
the first mulligan, the first Recover, hand size in alter-ego vs hero form, and the first draw with Spider-Sense. Each
is one line and a glossary link. G10 finalizes the list from what the engine emits.
