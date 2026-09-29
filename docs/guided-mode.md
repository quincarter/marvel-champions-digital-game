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
from the engine or `@mc/content`, never from the tiles. (The tiles' "Energy counts as 2 resources" is correct: Core _Energy_ prints two energy icons. The conditional double is _The Power of Justice_, only for Justice cards.)

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
7. **Aspect lessons** (owner, 2026-09-26: "lessons for the other aspects. When to choose what Aspect and what they
   are all used for"). There is an "Aspects" lesson track alongside the five core lessons, with one lesson per aspect
   (§5.4). Each covers what the aspect is for, when to pick it, and two or three signature Core Set cards shown as real
   scans, then ends with "Try it". That starts a short guided game vs Rhino with the Core precon of that aspect:
   Justice is Spider-Man, Aggression is She-Hulk, Leadership is Captain Marvel, and Protection is Black Panther. During
   that game, the aspect's own tips fire the first time its signature cards come up. The lessons are reachable from the
   debrief, Settings → Guide, and an "Aspects ▸" link on every aspect chip in Seats / Deck check / Deck builder. The
   shorter tip card version shows inline at those chips. Basic gets one tip card and no lesson. 'Pool is not in the
   playable pool yet, so it gets no lesson. The lesson table is data-driven, so adding 'Pool later is just one entry
   once the Deadpool pack is wired.
8. **Guide prefs persist in `localStorage` (`mc-guide`, versioned)**, copying `progression.ts`'s read/write pattern
   (fall back to defaults when storage throws). Other settings stay in memory. Persisting all settings is out of scope
   here.
9. **The first-run chooser shows on the first New Game** (owner, 2026-09-29: "I don't like that the game loads
   immediately into the tutorial. It should be after you start a new game."). The game always opens on Title. The
   first time the player presses New Game (no guide choice made yet), "New to the fight?" appears. Learn as you play
   goes to How to win, then the tutorial; Hints only / No guide save the level and continue into scenario select;
   Back or Escape returns to Title with nothing saved, so it asks again next New Game. It stays reachable any time from
   Title's **How to play** hub (G6c), whose modules force Full guidance for that one run.
10. **Never locked in** (owner, 2026-09-28: "There needs to be a way to skip or easily escape any tutorial in full mode.
    I don't want anyone to feel locked in."). This is a hard rule for every guided surface:
    - **Every guide surface always shows two exits:** "Skip this step" and "Stop tutorial". Stop tutorial ends the
      guidance for this game (the guide is off for the rest of it, and the saved level is untouched). You keep playing
      the same game, or you can leave to Title.
    - **Escape always works.** It dismisses the guide surface and releases the step's gate (the step counts as skipped).
      It is never swallowed; see the §7 key-ordering gotcha.
    - **Gating is soft.** During a "do this" step, the taught control gets the spotlight and `TRY THIS`, and other board
      input is inert. The menu/Pause button, Escape and the guide's own controls are never gated. After 2 inert clicks
      the gate lifts by itself, and the guide offers "Want to do something else? Skip this step".
    - **Pause has "Stop tutorial" and "Turn guide off"** whenever a guided run is active.
    - **Out of the game, every tutorial screen has Back** (hub, How to win, aspect pages), and the chooser has "No guide".
    - On desktop the side panel can also be collapsed, without stopping the lesson.
11. **Tutorial progressive unlocks** (tiles D01/D03). The Log tab and the Log chip unlock after lesson 5. They stay
    visible, dashed, with "Lesson 5" as the reason. Flip is taught in lesson 2, so it's live from the start.

## 4. Workstreams

**One agent per box, one at a time, in the session worktree** (owner: "Keep agents to small tasks to keep their
contexts smaller"). Each box is one primitive, one widget, one screen or one lesson. Don't hand an agent more than
one box. Every agent:

- reads this file,
- does only its box,
- runs typecheck, test and lint,
- adds a changie fragment,
- commits explicit paths as the repo's git user (no Co-Authored-By trailer),
- fetches and merges `origin/claude/guided-mode-designs-491431`, then pushes (never force),
- ticks its box here with a one-line `Landed:` note,
- replies with handoff notes: files touched, and anything the next box needs.

The main session verifies UI boxes by clicking through them before ticking (§6).

**Engine**

- [x] **G1 Stacked setup (`game-rules-architect`).** Add a replay-safe option to `GameSetupConfig`:
      `stack?: { players?: …; encounter?: readonly CardId[] }`. After the seeded shuffle, it moves the named codes to
      the top of that deck, in order. Thread it through `coreScenario` and client `SessionConfig`, including save and
      resume. Tests: replay is identical, a missing code is an error, and `undefined` leaves the RNG untouched.
      Landed: `GameSetupConfig.stack` (`SetupStack`, seat-indexed) via `coreScenario`/`playableScenario`/`SessionConfig`.

**Prefs and settings**

- [x] **G2a Guide prefs model.** `guide/guide-prefs.ts`: level (`full`/`hints`/`off`), `chooserSeen`, tutorial
      progress, aspect lessons done, silenced warnings, seen tips. Persisted as `mc-guide` v1, using the
      `progression.ts` pattern. Tests only.
      Landed: `48926aad`, `guide/guide-prefs.ts` (pure helpers, `withLevel` resets seen tips on off→full).
- [x] **G2b Settings rows.** A segmented row shape in `view/settings-rows.ts`. A Guide group with Guide level, "Play
      the tutorial", "Aspect lessons", and one toggle per warning, drawn in both the Settings overlay and Pause's
      inline group.

      Landed: `ac39611c` + fixes `ce5eb7b5` (one scroll region, yellow selected segment) and `8278e62f` (concepts kept out of Pause's on-table cards). Live prefs holder: `guidePrefs()` / `setGuidePrefs()` / `onGuidePrefsChange()` in `guide/guide-store.ts`. Tutorial and Aspect lessons rows are dashed "Coming soon" until G6b / G10c flip `unavailable` in `guideRowInfoOf`. Verified by the main session at 390, 1024 and 1440.

**Glossary**

- [x] **G3a Glossary basics.** Basic-concept entries in `@mc/content`'s glossary (threat, main scheme, acceleration,
      thwart, resource, cost, hero/alter-ego, flip, recover, exhaust, defend, consequential damage, encounter card,
      boost, villain phase, aspect), each a paraphrase with an RRG 1.8 cite. Surface them in `view/rules-reference.ts`.
      Landed: `c9e72859`, 21 `kind: "concept"` entries in `CONCEPT_GLOSSARY` (glossary.ts), always shown in the Rules reference; look up with `glossaryEntry(id)`.
- [x] **G3b `McTermText` + `McTooltip`.** Body text with dotted terms. Hover on desktop, tap on touch. The tooltip shows
      the term, one line and "Rules glossary ▸", which deep-links to `SCENES.rules`.

      Landed: `2c751776` (committed under a docs message by a staging race). Markup `[[id]]` / `[[id|label]]`; `ui/term-text.ts`, `ui/tooltip.ts`, `view/term-text-model.ts`; demo at `?screen=termtext`. A host with several `McTermText` blocks sharing one tooltip must call `setTermsEnabled` on all of them (see `scenes/term-text-demo.ts`).

**Guide surfaces**

- [x] **G4a `McGuideCallout`.** The anchored yellow callout (phone, and tablet portrait). Parts: `GUIDE` stamp, step
      label, Bangers title, `McTermText` body, secondary + primary actions, Skip lesson, and the arrow toward its
      anchor.
      Landed: `abad5ad1`. `ui/guide-callout.ts` (`update(content, anchorRect, viewport)`, `handleEscape`, `focusNext`, `activatePrimary`), layout in `view/guide-callout-model.ts`, demo `?screen=guidecallout`. Use `continueHint` for board-action steps. Mid-sentence terms need `[[threat|threat]]`, because a bare `[[threat]]` shows the capitalized display name.
- [x] **G4b `McGuidePanel`.** The collapsible yellow side rail (desktop, tablet landscape). Parts: lesson list, step
      body, tip box, progress ticks, Back, and the "do this to continue" slot. Board layout reserves the rail when it's
      open. Layout tests at 1440×900 and 1024×768.
      Landed: `9add1837` + polish `78bd6115` (paragraph breaks in `McTermText`, padding, stamp width, legend inset, Collapse hit area was off-label). `ui/guide-panel.ts`, `view/guide-panel-model.ts` (`guideRailWidthFor`), and `boardLayout(…, { guideRail })` in `view/layout.ts`. Demo at `?screen=guidepanel`. G5c mounts it on the Board for desktop and tabletLandscape only, and re-runs `boardLayout` on collapse/expand.
- [x] **G4c Spotlight + tags.** The spotlight ring on any board anchor (zone, card, button), dimming everything else
      with input gated per §3.10, plus the `TRY THIS` and `GUIDE PICK` tags. Landed: `d80f0796`. `resolveAnchor`
      (view/guide-anchor.ts), `McGuideSpotlight`, `McGuideTag`, and `GuideGateHolder` (scenes/board/guide-gate.ts) via
      `board.setGuideGate(gate | null)`. Escape → `onGateReleased`; 2 inert clicks → `onGateEscaped`. Pause is never
      gated. Demo at `?screen=board&guidedemo=1`. Its notes for G5c (panel-rect anchor, banner delay, tags only on
      actionable anchors, gate per step change, tab auto-switch, non-clashing keys) and the exits (`5b6993b2`: `onSkip`,
      `onStop`, `nudge`, Escape skips) are all done.

**Tutorial**

- [x] **G5a Tutorial config.** `guide/tutorial-config.ts`: seed + Spider-Man precon + stack (§5.1). A test plays the
      scripted commands and asserts each lesson's precondition state.
      Landed: `d1b08352`. Seed 2024; hand Black Cat, Energy (pays her 2 alone), For Justice!, Aunt May, Spider-Tracer, Backflip; encounter Armored Rhino Suit (boost 0) then Advance. Black Cat blocks Rhino's 2 and is defeated; round 2 threat is 3 and Thwart is legal. `TUTORIAL_SCRIPT` (7 commands) is exported for G5b/G7 tests.
- [x] **G5b Lesson model.** `view/lesson-model.ts` is a pure state machine: lessons → steps, each step with an anchor,
      copy, and a completion predicate over store state/events. It's data-driven so the aspect lessons (G10) can reuse
      it. Tests drive it with recorded events.
      Landed: `18ebe444` (plus a copy fix). `view/lesson-model.ts` pure reducers (`startLessons`, `observe`, `acknowledge`, `back`, `skipLesson`, `replay`) and selectors. Lessons are in `guide/tutorial-lessons.ts`. Call `observe` again after every button reducer. Lessons run in strict order. `{target}` must be passed via `fillCopy`'s `extra`.
- [x] **G5c Guide controller.** The board-side glue that feeds store events to the lesson model and shows
      G4a/G4b/G4c for the current step. No lesson content yet, just one smoke step.
      Parts 1–2 landed: `0e0c6d94`, `606ba3a1`, `1a14f60b`. `GuideController` (guide/guide-controller.ts) with waiting and complete states; `BoardGuideMount` (scenes/board/guide-mount.ts) draws the rail on desktop and tabletLandscape and the callout on tabbed layouts (auto-switching the tab once per step); dev jump `?screen=board&tutorial=1`. Part 3 `1b4af716`: Pause "Stop tutorial" / "Turn guide off" (only while a guided run is active), `runLabel` "First game", and `guidedRun` reset on non-guided starts. **Left for G7:** - (G7c) The villain-phase overlay and the defend choice sheet cover the guide entirely, so lesson 4's copy is never visible. Inset those overlays by the rail on desktop, and show a bottom guide strip on phone as in P05. - (G7b) On tabbed layouts a hand tap opens Inspect first, so say "Tap Black Cat, then Play" and tag Inspect's Play button.
- [x] **G6a First-run chooser.** P01/T01 "New to the fight?". Wired Boot → chooser (first launch) → Title. "Learn as you
      play" goes to G6b.
      Landed: `7431ecff`. `scenes/guide-chooser.ts` + `view/guide-chooser-model.ts`; Boot → chooser on `isFirstLaunch`; dev jump `?screen=chooser`. `#startLearnAsYouPlay()` is the single call site where G6b's How to win slots in.
- [x] **G6b How to win.** P02 "One way to win, two ways to lose" from Rhino / The Break-In! / Spider-Man data. Start the
      fight launches the tutorial game (past scenario and seat selection). Tell me more opens Rules reference.
      Landed: `4775be5c`. `scenes/how-to-win.ts` + `view/how-to-win-model.ts` (real stage count, target and HP) and a shared `guide/start-tutorial.ts`. The flow is chooser → How to win → board; Settings "Play the tutorial" opens it; dev jump `?screen=howtowin`. The wide layout was recomposed in `ab9a8563` (1200 max width, portrait WIN card, no dead gap). Polish: show the main scheme art at landscape aspect, since it's cropped today.
- [ ] **G6c "How to play" learning hub** (owner, 2026-09-28: "how to play could launch some tutorial screen and they
      could work their way through the learning modules"). A Title menu button opens a hub screen with every module,
      each showing done/next, and a recommended order the player can ignore: - **The basics:** the five tutorial lessons, each as a row. Lesson 1 starts the tutorial game from the top. Any
      later lesson starts the same `TUTORIAL_CONFIG` game and replays `TUTORIAL_SCRIPT` up to that lesson's start
      point before handing over. This is replay-safe, because G1 made the setup deterministic. - **Aspects:** the four aspect lessons, each with a lesson page and Try it (G10c/G10d render inside the hub). - **Reference:** Rules reference and glossary.
      Modules always run at Full for that run only (the saved level is untouched), and replays don't reset saved
      progress. The chooser's "Learn as you play", Settings' "Play the tutorial" and the debrief's "Replay a lesson"
      all route here. Split it at brief time: (1) hub screen + progress model, (2) replay-to-lesson start.
      Part 1 landed: `48787de5`. `scenes/how-to-play.ts` + `view/how-to-play-model.ts`; Title "How to play"; Settings, debrief and `?screen=howtoplay` all route here; a run-only Full override (`setGuideRunLevelOverride`, guide-store) that never writes the saved level. G10c wires `HowToPlayScene#openAspectLesson`. Part 2 landed: `8f24b001`. `guide/tutorial-checkpoints.ts` (script prefix per lesson) and `startTutorialGame({ startAtLesson })` replays through the store; `appSession().guidedRunAlreadyDone` holds the run-only done lessons. The board's `alreadyDone` consumer line is in (`a19e5b25`); verified that picking "The villain phase" from the hub opens on lesson 4. Nit: "THE BASICS" sits tight under the header.
- [x] **G7a Lesson 2: Hero & alter-ego.**
- [x] **G7b Lesson 3: Paying for cards** (over the existing payment bar).
- [x] **G7c Lesson 4: The villain phase** (villain-phase overlay steps + `GUIDE PICK` on the defend sheet).
      Landed: `28ffbb40` + `b2fe58da`. The overlays inset by the rail; a live "This villain phase" checklist in the rail; the phone `ui/guide-strip.ts`; the phase band no longer covers the rail; the phone defend-sheet overlap is fixed (it also affected non-guided games). Polish idea: in guided runs, add a "Your HP after" line to each defend option, as in the D02/P05 tiles.
      Landed: `caced651`. `doThisTabbed` ("Tap Black Cat, then Play"), a TRY THIS tag on Inspect's Play with a guide strip in Inspect (`setGuidePick`), and Energy → Pay tags on phone. Nit: the final hint reads "Pay"; "Tap Pay" would read better.
- [x] **G7d Lesson 5: Threat & thwarting** (the threat ring on the scheme, then Thwart).
      G7a + G7d landed: `55ec18c6`. "How do I stop it?" / "Got it" (`secondaryLabel`), the thwart-step threat preview on the scheme meter ("3 → 2 /7", live THW), and "Tap Pay". Lesson 2 copy checked. For G11: the villain-phase walkthrough can take a few seconds (or a SKIP) to clear before the board shows; consider faster pacing in guided runs.
- [x] **G8 Round debrief.** P07/D03: lesson checklist, "Worth remembering" (tested heuristic), "New on your board",
      guide-level control, Replay a lesson, Round N ▸, and "Next: Aspects ▸" after lesson 5.

      Part 1 landed: `e8db5af6`. `scenes/round-debrief.ts` (`showRoundDebrief(scene, { lessons, round, events, level, onNextRound, onReplayLesson? })`), `view/round-debrief-model.ts` (4 named "worth remembering" heuristics), demo `?screen=debrief`. Part 2 landed: `e597eb92` + a level fix. It fires once per round in guided runs (`view/round-debrief-trigger.ts`); the Log tab/panel is locked until lesson 5 (`view/log-gate-model.ts`); finishing the tutorial drops the run to Hints via the run override (the saved level is untouched), and a pick in the debrief's selector saves. Open nit: the complete-state button should read "Keep playing ▸". Nits: the Up next subline is wordy; the Round N button uses body type, not Bangers.

**Hints**

- [x] **G9a Hint heuristics.** `view/guide-hints.ts`: the four heuristics from §5.2, tests only.
      Landed: `01f2deb5` + `13f5551d` (`lethalHint` plans the best block — allies take the biggest attacks, the hero defends one by DEF, Overkill spills over, stunned attackers are skipped — since everything readies at the end of the player phase). `hintsFor({ state, deps, playerId, trigger }, prefs)` with triggers `endTurn`, `flip` and `confirmPayment`. Crisis uses `iconsInPlay(state, deps, "crisis")`.
- [x] **G9b "Hold on!" overlay.** P06/T03. It intercepts the triggering command like `end-turn-confirm`, offers the
      safe action first, and has a "Don't warn me" checkbox. Active at Full and Hints.

      Landed: `8ffa2e13` (its `board.ts` host wiring was swept into `caced651` by the shared worktree; the content is correct). `scenes/hold-on.ts`, `view/hold-on-model.ts`, controller interception for End turn, Flip and payment confirm (the anyway path continues into End turn's confirm); demo `?screen=holdondemo`. Visual polish landed in `c2d72b62` (ink safe button with an amount chip, content-fit card, threat bar with the hatched next-phase segment and YOU LOSE). **G11 must trigger it on a live board** (it's verified in tests and the demo only).

**Tips and aspects**

- [x] **G10a Aspect content.** `guide/aspects.ts`: the §5.4 table as data (lesson copy, when to pick, signature card
      codes, precon id, the tip card line). Tests check that every code exists and every precon has that aspect.
      Landed: `0c0b7923`. `guide/aspects.ts` `ASPECT_GUIDES` / `aspectGuideOf`. Aggression uses Uppercut (01054) in place of Tackle, which isn't in Core. Adding 'Pool later is one entry.
- [x] **G10b Aspect tip chips.** "Aspects ▸" and the short tip card on aspect chips in Seats, Deck check and Deck
      builder.
      Landed: `33bd1aa6` (tip lines reworded as "pick it when" advice). An "i" badge on the aspect chips in Seats, Deck check and Deck builder opens `ui/aspect-tip.ts`'s panel, shown at every guide level. G10c wires `linkAvailable` / `linkReason` in `view/aspect-tip-model.ts`.
- [x] **G10c Aspect lesson page.** The per-aspect lesson page inside G6c's hub (signature scans, when to pick it, Try it).
      Reached from the hub, the debrief, Settings → Guide, and the chips' "Aspects ▸".
      Landed: `3457bdd3` (its registry edits were swept into `48787de5`). `scenes/aspect-lesson.ts` + `view/aspect-lesson-model.ts`, dev jump `?screen=aspect&aspect=<id>`, `#onTryIt(aspect)` for G10d. Follow-up `19e989c7`: large signature scans; the phone gap is fixed; it's wired into the hub rows (✓ Done), the chips' Aspects ▸ (launched over Seats/Deck check, `backTo: "previous"`) and Settings' Aspect lessons → hub. Nit: a ~60px gap under the phone "SIGNATURE CARDS" label.
- [x] **G10d Aspect try-it games.** A guided Rhino game with that aspect's Core precon. Its aspect tips fire when the
      signature cards come up, on G5b's lesson model.
      Landed: `c71192bd`. `guide/aspect-tryit-config.ts` (a stacked, turn-1-playable signature card per aspect), `guide/aspect-lessons.ts`, `guide/start-aspect-tryit.ts`, `appSession().guidedRunKind`; aspect runs have no debrief and no Log lock. Main session `ed2d3a45`: Hold on! defers to an active guide step (it fired on the lesson's own payment), and Escape dismisses a tip. Polish `c17f16eb`: the payment TRY THIS walk is generalized via `payWith` (`view/guide-paying-override.ts`); the header label truncates; the complete copy points to How to play; one red button on the aspect page.
- [ ] **G10e Opportunistic tips.** `view/guide-tips.ts` is the trigger table (§5.3). Once each, Full only, shown as a
      small callout.

      Part 1 landed: `0d264e63`. `tipsFor(observation, prefs, suppress)` in `view/guide-tips.ts`: 12 named situational triggers plus a generic glossary catch-all (`keyword:<id>`), Full only, once each. **Part 2 (display) must:** show at most one tip per player turn, and not in the opening seconds (`situation:handSizeDiffers` and `situation:acceleration` are true from the first frame); suppress tips a tutorial lesson covers; thread the session's real `EngineDeps` in place of `DEFAULT_DEPS` so ability-granted keywords count; and add a mulligan glossary concept (the tip has no term link today). Part 2 landed: `a19e5b25`. `view/tip-schedule.ts` pacing, the `McTipToast` surface, and `scenes/board/tip-mount.ts` in every Full-level game (real `POOL_DEPS`); the `mulligan` glossary concept was added. Follow-up `f7f656bd`: the toast sits in the play area (desktop) or above the hand (phone), clear of every control; `situation:acceleration` fires only on tokens or icons. Escape dismisses it (`ed2d3a45`).

**QA**

- [ ] **G11 QA pass.** A headless click-through of the tutorial and one aspect lesson at 390×844, 1024×768 and
      1440×900, with reducedMotion on and off, and screenshots beside the tiles.
      Phone QA findings (to fix after all three reports): (1) critical: the villain-phase interrupt choice (Spider-Sense) launches undrawn until a redraw; (2) the phone guide strip has no "Got it", so lesson 4's acknowledge step sticks, GUIDE PICK never shows, and the debrief misreports lesson 4; (3) the 2-inert-click nudge is computed but not rendered on phone; (4) the phone waiting-state callout covers the action bar and End Turn. Desktop QA findings: (5) high: collapsing then expanding the rail crashes (`McLazyText` wordWrap < 1 char) and leaves it stuck collapsed, because `McGuidePanel`'s collapsed tab calls `expand()` on the stale per-frame instance with the collapsed rect (ui/guide-panel.ts `#drawCollapsed`; guide-mount builds a fresh panel each frame); (6) medium, pre-existing: an engaged minion draws twice (enemies + your play area), because `view/board-model.ts` `myPlayArea` doesn't exclude minions that `minionsEngagedWith` returns; (7) live Hold on! still unverified, needing a stacked, deterministic boundary game. Tablet QA findings: the same lesson 4 desync from both sides (an acknowledge step sticks if the player plays on without "Got it", so step 4 and GUIDE PICK are skipped and the debrief lies); the nudge isn't rendered on the rail either; the portrait callout × stops the tutorial in one tap with no label; the portrait flip button truncates to "TO HERO". **Fix plan:** wave 1 (parallel): (A) a robust lesson 4 (acknowledge steps auto-advance, state-based predicates, a strip Got it); (E) the invisible interrupt choice; (F+H) the minion double render + the flip label. Wave 2: one agent on guide-mount surfaces (the nudge redraw, the phone waiting placement, × confirm, the rail expand crash). Then (I) a deterministic live Hold on! fixture, and a QA re-run of the gaps (aspect Try-it, chips, tips, reducedMotion ON). Not covered on phone: live Hold on!, tips, aspect chips, aspect Try-it scroll, settings persistence, and the reducedMotion ON pass.

The order is G1 → G2a → G2b → G3a → G3b → G4a → G4b → G4c → G5a → G5b → G5c → G6a → G6b → G7a–d → G8 → G9a → G9b →
G10a–e → G11. Boxes whose files don't overlap can run side by side (at most 3): G2a with G3a, and G9a with G10a.

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
is one line and a glossary link. G10e finalizes the list from what the engine emits.

### 5.4 Aspect lessons

The copy is original. Don't transcribe FFG text. Signature cards are Core Set cards that are in the playable pool.
G10a checks their codes.

| Aspect     | What it's for                                                                     | Pick it when                                                                                                   | Signature Core cards                          | Try-it precon  |
| ---------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------- |
| Justice    | Thwarting. Keeps threat off schemes. The balanced, steady pick.                   | The villain schemes fast, or has side schemes that punish you. It's a good first aspect for learning the loop. | For Justice!, Great Responsibility, Daredevil | Spider-Man     |
| Aggression | Attacking and brawling: burst damage, clearing minions, racing the villain.       | You want to end the game fast, or the scenario floods the board with minions.                                  | Relentless Assault, Uppercut, Hulk            | She-Hulk       |
| Leadership | Allies. It fields more of them and makes them hit harder and stay longer.         | Your hero likes a wide board. Allies soak attacks, thwart and chip damage every round.                         | Inspired, Lead from the Front, Maria Hill     | Captain Marvel |
| Protection | Defending and healing: blocking attacks, preventing damage, staying alive.        | The villain hits hard, your hero has low HP or DEF, or you're the team's tank in multiplayer.                  | Counter-Punch, Armored Vest, Luke Cage        | Black Panther  |
| Basic      | Neutral cards any deck can use (resources, staples).                              | Always available alongside your aspect. It gets a tip card only, no lesson.                                    | Energy/Genius/Strength, Avengers Mansion      | —              |
| 'Pool      | Not in the playable pool yet. It gets no lesson until the Deadpool pack is wired. | —                                                                                                              | —                                             | —              |

G10a confirms each signature card is Core, has that aspect, and is in that precon (or swaps it for one that is).

## 6. Handoff: resuming this work

A fresh Claude session can pick this up from this file alone.

- **Branch:** `claude/guided-mode-designs-491431`, pushed to origin. The PR is linked in the PR description's
  checklist, which mirrors §4.
- **Worktree:** `/Users/quincarter/Documents/Dev/marvel-champions-game/.claude/worktrees/guided-mode-designs-491431`,
  in the main clone at `/Users/quincarter/Documents/Dev/marvel-champions-game`. There's no second worktree and no
  agent worktree. Every agent runs in this worktree, one at a time. A hook blocks subagent writes to sibling
  worktrees.
- **Agents:** none are left running between sessions. The in-flight box, if any, is listed under "In flight" below.
  If it's unticked and has no `Landed:` note, re-run it. Check `git log` first for a partial commit.
- **Base:** PR #69 targets `feature/wave-5` (PR #64, Wave 5), not `main` (owner, 2026-09-28). Sync with `git merge origin/feature/wave-5`, not main.
- **Resume:** `git fetch && git merge origin/claude/guided-mode-designs-491431`. Then take the first unticked box in
  §4 and brief one agent with that box only (the matching specialist from CLAUDE.md, usually `game-client-engineer`),
  pointing it at this file.
- **Verify UI boxes** in a browser at 390×844, 1024×768 and 1440×900 before ticking. Run the worktree's own Vite on
  port 5183 (`pnpm --filter @mc/client exec vite --port 5183 --strictPort`). Click every control with a real
  pointer, and put a screenshot beside its tile.
- **Commits:** as the repo's git user, with no Claude co-author trailer. Every change carries a changie fragment.

**In flight:** the G11 rerun (a), fix regressions + the full tutorial. Rerun (b), coverage gaps, passed with 0 console errors: all 4 aspect Try-its, chips, live Hold on! at 3 sizes, phone settings persistence, hub start-at-lesson. Nits: `__mcAspectLessonDebug.tryItRect` is scroll-unaware; `__mc*Debug` hooks aren't cleared on shutdown; the Deck builder aspect tip overlaps its chip slightly. Tips during real play are unverified and need a stacked fixture (a minion engages turn 1). **Queued after (a):** (1) the owner's tutorial reorder, where lesson 2 = Paying as Peter using his Scientist resource ability (+ one 1-icon card), plus a resource-types legend and Energy/Mental/Physical/Wild glossary entries, and lesson 3 = flip; (2) the tips fixture + a live check; (3) the nits.

## 7. Prior art: the parked prototype

An earlier session built a guide without the designs. It's parked as `cf134edf` on
`origin/claude/guided-mode-game-tips-0a600f` (never merged, never checked in a browser). Read it with
`git show cf134edf:<path>` and reuse the ideas and copy, not the structure. Paths are under `packages/client/src`.

| Piece                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Reuse in                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `teaching/teaching-prefs.ts`: the `mc-teaching` localStorage store with a tolerant parser. `session.ts` `commitSettings` resets seen tips when tips are switched back on.                                                                                                                                                                                                                                                                                                 | G2a (rename to `mc-guide`) |
| `view/guide/game-tips.ts`: keyword and status tips come from `rulesGlossaryOf`, so new packs get tips for free. It excludes `exhausted`, `ready` and `facedownBoostCard`, which would otherwise fire on frame one. It also has situation heuristics: threat ≥ ⌈2/3 × target⌉; hero HP ≤ ⌊max/3⌋, with advice by form; any side scheme; crisis ("your cards can't remove threat from the main scheme", RRG 1.8 p. 14, which says player cards only); and a minion engaged. | G10e, G9a                  |
| `view/guide/setup-guide.ts`: `seatWarningOf` / `seatScalingOf` compare scaled villain HP and scheme target with the solo numbers (it exports `villainTotalHp` from `view/table-setup-preview.ts`). It also has step copy for scenario select, seats, table setup and mulligan.                                                                                                                                                                                            | G10e (setup tips)          |
| `view/guide/round-guide.ts`: round-1 steps built from `BoardModel`, and a villain-phase step that waits until `phase === "villain"`.                                                                                                                                                                                                                                                                                                                                      | G5b / G7 (reference)       |
| `view/guide/table-help.ts`: copy for a "?" panel that explains the table.                                                                                                                                                                                                                                                                                                                                                                                                 | G3b or G10e                |
| `ui/coach-state.ts` `coachKeyFor`, a **gotcha**: Phaser 4 runs keyboard handlers in scene-start order, so an overlay can't `stopPropagation` Escape away from the scene beneath it. The key owner is checked in the shared `bindKeyboard`.                                                                                                                                                                                                                                | G4a / G4b / G9b            |
| `view/guide/guide.test.ts`: tests against a real Rhino game.                                                                                                                                                                                                                                                                                                                                                                                                              | G5a (pattern)              |
