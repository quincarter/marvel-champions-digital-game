# Wave 6 handoff (cycle 6 in our ids, Mutant Genesis)

For any session picking up the Wave 6 PR, local or cloud. The PR body has the checklist; this page carries how to
resume, the scope, and anything decided along the way. Rules for running agents are the same as wave 5's
([phase7-wave5-handoff.md](phase7-wave5-handoff.md) "Rules for agents" and "Lessons from review"), and CLAUDE.md "How
to split work across agents". Started 2026-10-01.

## Resuming

- **Branch:** `feature/wave-6`, off `main` at c3673bc5 (v0.14.0 + #92). Everything finished and verified is pushed
  there; each verified commit goes up as it lands.
- **Read first:** the PR checklist, this page, then `docs/phase7-wave6-sources.md` and `docs/phase7-wave6.md` once
  they exist.
- **Definition of done:** [wave-definition-of-done.md](wave-definition-of-done.md), including §4b (custom decks) and
  Guided mode coverage in §5. The wave ships the MC32 Mutant Genesis campaign in the same PR.

## Scope

Our `cycleId("cycle6")` (Core is `cycle1`); the packs' `Cycle` records still read "Cycle 6" and should be renamed to
"Mutant Genesis" when the wave is emitted. To be confirmed against RRG 1.8 Appendix VI by the sources doc.

| Pack      | Type          | Release (pack data) | Card data today                            |
| --------- | ------------- | ------------------- | ------------------------------------------ |
| `mut_gen` | Campaign box  | 2022-09 (to check)  | not emitted (curation file missing)        |
| `cyclops` | Hero pack     | 2022-09-30          | data only                                  |
| `phoenix` | Hero pack     | to check            | not emitted (curation `phoenix.ts` exists) |
| `wolv`    | Hero pack     | 2022-11-11          | data only                                  |
| `storm`   | Hero pack     | 2022-11-11          | data only                                  |
| `mojo`    | Scenario pack | 2022-11-11          | data only (MojoMania)                      |
| `gambit`  | Hero pack     | 2023-02-24          | data only                                  |
| `rogue`   | Hero pack     | 2023-02-24          | data only                                  |

## Known gaps for the hero-pack spec pass

- **Storm's Weather deck** (`storm` 36002–36005). The precon (3ada7537) still lists the four Weather supports in
  `storm-leadership`'s 44 cards; they belong in a separate Weather deck (printed list: 40 + 4 weather). Per the MC36
  Storm rules insert ("The Weather Deck"), it is shuffled facedown next to the identity, with no faceup top card, no
  discard pile and no reshuffle; setup chooses one Weather support into play, and Weather Control / Weather Goddess
  swap the in-play support with another from the deck (the supports are Permanent). Today
  `scripts/marvelcdb/normalize/separate-decks.ts` hardcodes Invocation's rules (`topCardFaceup: true`,
  `discardPile: "own"`, `whenEmpty: "reshuffleDiscardWithoutPenalty"`) and `createGame` builds only that kind. Needs:
  curation fields for those three, the engine building a no-discard facedown deck, and a swap primitive. Then move
  36002–36005 to `separateDecks` and the deck drops to 40.

- **Obligation keyword parsing** (25edb354, for Paparazzi's Hinder and Watch Me Play's Incite/Peril): keyword
  sentences before an obligation's first header now parse as keywords. On the next regen this also gives Shuri's
  obligation (`bp`, "Uses (4 doubt counters). Victory 0.") and Falcon's ("Uses (3 emergency counters)") real `uses` /
  `victory` keywords. Neither pack has been regenerated, so nothing changed yet; whoever regenerates `bp` must check
  Shuri's obligation script doesn't then place its counters twice.
- **`curation/types.ts` comments** from 25edb354 show a mojibake `Â§` for `§` (cosmetic).

- **Expert villain versions' stage numbers.** MaGog's record (and Mansion Attack's, the same shape) says expert
  `villainStages: [1, 1]`, but the one-stage expert cards (39001b, 32121b–32124b) carry `stageNumber: 2`.
  `wave6Scenario` (1e11e7b4) uses the card's own first/last stage. Fix the record or the card numbering when MaGog or
  Mansion Attack is scripted.
- **`WAVE6_CARDS` in `@mc/cards`** appends the wave's packs because `PLAYABLE_CARDS` doesn't include them yet; remove
  that spread when content's `WAVE6_*` exports join `PLAYABLE_CARDS`, or every wave 6 card is counted twice.

- **§3.19 follow-ups** (main scheme stage into the victory display): an advance run from inside a When Revealed (Mansion
  Attack 1B) still resolves the earlier stage's starting-threat placement and `mainSchemeAdvanced` after the new
  stage's (harmless for 1B, whose values are dashed); `keywordValueSum` reads card-level keywords only, so a
  stage-level Victory keyword wouldn't count (none is printed today).
- **Client log lines (done):** `healBlocked`, `damageCapped`, `boostWithheld`, `activationBlocked`, `consequentialDamageModified`, `mainSchemeStageToVictoryDisplay`, `attackResolved.damageTo` and `schemeResolved.removesThreat` have lines in `log-lines.ts` (and card history); `mainSchemeStagesShuffled` says only "The main scheme stages are shuffled." Still owed: the defend prompt's redirect preview (`defendPreview`/`StackEntry` don't expose the `damageTo` slot), and no `keywordIgnored` / `countersPlaced` events exist in the engine.

- **Teamwork / quickstrike follow-ups** (2a1df964): flipping a card to a minion face and `putIntoPlayFacedown` trigger
  neither keyword (as quickstrike today); `quickstrikeAttack` reads keywords without `deps`, so a granted quickstrike
  is missed.
- **Clea** (`wave1/drs/pack-cards.ts`) is scripted as `instead(moveCards deckShuffle)`, so her defeat never completes
  and Operation Zero Tolerance doesn't take her (FAQ #104 names "shuffled into a player's deck"). Likely needs
  `setDefeatDestination("deckShuffle")` as Regroup uses; check before changing a wave 1 card.
- **Scenario obligations with no encounter set** (cross-wave): the normalizer gave every non-campaign obligation
  `encounterSetIds: []`. Fixed for `mut_gen` and `mojo` in this wave; still to regenerate: `sm` 27132, `toafk`
  11018–11021 and 11049, and the data-only `aoa`, `aos`, `cw`, `next_evol`, `synthezoid` obligations.
- **Boom Boom** (32090, Project Wideawake Captive ally) needs a per-target damage amount: no §3 row yet.

- **New engine row needed: an ally attached to a scheme** (Robert Kelly 32066 on Find the Senator, Sabretooth e6a4ef05):
  `checkDefeats` (`resolve/defeat.ts`) sweeps only allies in a player's play area, so lethal damage never defeats an
  attached Kelly (Stalked by Sabretooth can't lose the game while he's attached: pinned `it.fails` in
  `sabretooth.test.ts`); and a player card can't target him while attached ("no valid target"). Queue it as §3.75
  after Nimrod (§3.4).
- **Sabretooth notes:** `completeMainScheme` ends the game on the final stage before When Completed runs (32064b's
  Defeat Kelly is pinned structurally); `canHaveAttached` isn't exported from `@mc/engine`; `wave6Scenario` now drops
  32065b as a separate card (`withoutBackFaces`).

- **New engine row needed: "the topmost X in the encounter discard pile"** (Sentinel Mark VIII 32114, Master of
  Magnetism 32151): `encounterCards.top` only limits a deck, so a selector attaches every matching card. Needs e.g.
  `encounterCards.topmostOnly`. Wave 2's Zola's Experiments (`wave2/trors/zola.ts`, 04124) uses the same selector and
  probably attaches every match today; its test only checks the ref exists. Queue as §3.76.

- **New engine row needed: an identity-scoped "cannot thwart"** (Wrapped in Metal 32148-ish, "Attached identity cannot
  thwart"): c84834d7 uses `basicThwartOnlyAgainst` with no scheme, which blocks the basic thwart only; the identity can
  still resolve a thwart event or ability. Queue as §3.77.

- **New engine row needed: a resource counted per status card** (Titanium Muscles 32005, "for each tough status card"):
  `generatesPerCard` counts cards in play only. Queue as §3.78. (Spec §4.1's row pointing this at wave 4 §3.38 is wrong.)
- **Engine gap: an interrupt offered when its cost can't be paid** (Nightcrawler 32011's energy cost): the offer check
  doesn't test payability; it is offered, then fails at payment. Probably cross-wave; check `candidatesFor` against how
  actions test costs.

- **Mutant Protectors (FAQ #17) engine gaps** (`mut_gen/precon-player-cards.ts`): a defense-labelled play also announces
  `defended` for the hero while the ally defends (pinned `it.fails`); "the ally leaves play before damage → the hero
  becomes the defender" is an `it.todo` (the attack still resolves against the departed ally). Powerful Punch's
  mass-form flip timing (FAQ #14) is left for Shadowcat's e2e. `colossus/cross-hero.test.ts`'s "no script yet" comment
  for 32014–32018/32021 is stale.

- **Engine gap: divided damage ignores card damage bonuses** (Team Strike 32045 + Aggressive Energy, ruling Jun 25,
  2026 (2): +1 to each enemy damaged): `executeDivide` (`resolve/effects-frame.ts`) deals each share without
  `cardEffectBonus`. Pinned `it.fails` in `shadowcat/events.test.ts`. Queue as §3.80.
- **Flaky test:** `mansion-attack.test.ts` "Save the School random pick" times out at 5 s under full-suite load (passes
  alone and on a clean clone). Give it a longer timeout or a cheaper setup.

- **Campaign cards 171–175 (61ab4a2f) engine gaps:** a flip to another card type discards tucked cards (173A re-tucks
  Rescue Captives' allies by hand; a keep-tucked flip would be cleaner); `flipToOtherFace` puts an obligation face in
  the villain area under no one's control (174A adds a `putIntoPlay` after the flip). Untested: 173A's deck search
  with no ally in the deck (`chooseCards` min 1: check it can't soft-lock), Rescue Captives with a non-Sentinel minion.
- **Pending owner confirmation, built on the recommended defaults (2026-10-02):** Q48 = A (a window's responses fixed
  when it opens, 0948e721), Q49 = A (Permanently Phased's own flip, 73d1c7c3), the Captive allies treated as
  encounter-backed (their `cardBack` still unset in data).

- **Role upgrades 176–195:** 12 of 20 scripted. Skipped until their rows land: Coup de Grace 32176/32181 (§3.29),
  Group Assault 32183 and Rescue Operation 32193 (§3.31). Need new rows: §3.81 partial damage prevention set when an
  attack is initiated (Brazen Defense 32178), §3.82 a heal divided among characters (Compassion 32182/32192), §3.83
  "this attack removes threat instead of dealing damage" (Determined Defense 32189). Engine oddity: a thwart-labelled
  `divide` offers the main scheme while a crisis icon makes its threat unremovable (a blind pick removes 0).

- **§3.29 follow-ups** (292979e9): a `divide` "(attack)" (Team Strike, Wasp Sting Giant) never creates an attack frame,
  so "When you attack" and `extraDamage` don't reach it (pre-existing; suggest +N per enemy damaged if wrapped later);
  extra attacks from `resolveAttackAgainst` (Thor) don't copy the original attack's `modifyAttack` changes.

- **§3.28 follow-ups** (7a20d383): "Max 1 TEAM card per player" on Falcon's Flight Squadron and Storm 36018 gets
  `maxWithTrait` only when those packs are re-emitted (their `-constant-2` ids shift to `-constant`, as 32013/32043
  did); taking control of a card in play doesn't check the per-player trait limit yet.

- **Engine gaps from Cyclops's events:** (1) an attack event pattern can't name the card whose ability made the attack
  (`attackKind: "ability"` + `sourceIs: identity` also matches Ricochet Beam's attacks), so Full Blast 33008 is offered
  on them too: needs a pattern field on the attack's source ability/card (§3.84); (2) an interrupt whose cost can't be
  paid (Full Blast with Cyclops exhausted; Nightcrawler 32011) is still offered — the offer check should test payability.
- **Unscripted aspect/basic events in the cyclops pack:** Teamwork 33017, Game Time 33022, Psychic Rapport 33023 (needs
  Phoenix Force).

- **Cyclops skips needing engine work:** Ruby Quartz Visor 33003 — `useAbility` prices an ability's payment with
  `payingFor` null, so a `generatesFor` resource can't pay for Optic Blast and `paidFor` is never bound (fix:
  `payingFor = plan.payingFor ?? command.cardInstanceId` in `actions.ts` and the `legal.ts` mirror); Dust 33012 — a
  one-shot `modifyConsequentialDamage` (§3.31 built only the rule form); Coordinated Attack 33016 — the attacked minion
  isn't recorded when the attack deals no damage (`targetInstanceId` on the consequential damage event).

## Agents running now

As of 2026-10-02 ~11:40 UTC (the owner is near their weekly usage limit; resume from here):

- **Done and pushed:** the Mutant Genesis box (all five scenarios, every modular set, Colossus, Shadowcat), the MC32
  campaign (definition, campaign cards 171–175, 17 of 20 role upgrades, QA with real games, story + scenario intros,
  seen in the browser through issue #1 starting), the wave in the playable pool + `UNLOCK_WAVES`, Cyclops, Phoenix and
  Wolverine fully scripted with precon e2e and cross-hero tests, Storm's Weather deck (§3.45/§3.46, precon 40).
- **In flight when this was written:** §3.47 `swapCards` + Storm's identity and Weather supports (uncommitted engine
  files `resolve/swap-cards.ts` etc. may be in the working tree of the user's Mac; a fresh session should redo §3.47
  from the spec if they aren't on the branch).
- **Next, in order:** Q50 = A engine change (Coordinated Attack keeps its reduction when the attack defeats its host);
  Storm's events, supports/upgrades/allies (incl. Uncanny X-Men 36018's `maxWithTrait` re-emit), obligation +
  nemesis, precon e2e; then MojoMania (§3.59–§3.73, §8 rows 43–51; its campaign §3.72, Q33), Gambit (§3.52–§3.55),
  Rogue (§3.48–§3.51, §3.56, §3.57); the remaining role upgrades (§3.82 Compassion, §3.83 Determined Defense);
  Titanium Muscles (§3.78); then QA docs, Guided mode coverage (DoD §5), the MarvelCDB decklist fixtures (§4b).
- **Waiting on the owner:** a Captive ally's card back (Rictor); Colossus and Shadowcat hero art.
- **How each push is checked:** `pnpm check` on a clean local clone (`git clone --local` into the session scratchpad,
  `pnpm install --offline --frozen-lockfile --ignore-scripts`), because agents' uncommitted files sit in the shared tree.

## Decisions made by the user during the wave

None yet; the spec's §4.1 table will hold them.
