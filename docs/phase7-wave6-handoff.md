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
- **Boom Boom** (32090, Project Wideawake Captive ally): scripted in 5bdfb8cc (`dealDamage` `perTarget`,
  `removeEachCounterFrom` `bind`, `varFor`).

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

- **Done (00c29eb5): a resource counted per status card** (Titanium Muscles 32005, §3.78): `statusCount` value and
  `generatesAmount(resource, n)`. (Spec §4.1's row pointing this at wave 4 §3.38 is wrong.)
- **Engine gap: an interrupt offered when its cost can't be paid** (Nightcrawler 32011's energy cost): the offer check
  doesn't test payability; it is offered, then fails at payment. Probably cross-wave; check `candidatesFor` against how
  actions test costs.

- **Mutant Protectors (FAQ #17) engine gaps** (`mut_gen/precon-player-cards.ts`): a defense-labeled play also announces
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
  "this attack removes threat instead of dealing damage" (Determined Defense 32189). Engine oddity: a thwart-labeled
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

As of 2026-10-02 (second session; resume from here):

- **Done and pushed:** the Mutant Genesis box (all five scenarios, every modular set, Colossus, Shadowcat), the MC32
  campaign (definition, campaign cards 171–175, 17 of 20 role upgrades, QA with real games, story + scenario intros,
  seen in the browser through issue #1 starting), the wave in the playable pool + `UNLOCK_WAVES`, Cyclops, Phoenix and
  Wolverine fully scripted with precon e2e and cross-hero tests, Storm's Weather deck (§3.45/§3.46, precon 40).
- **Also done:** §3.47 `swapCards` (`packages/engine/src/resolve/swap-cards.ts`, DSL `swapCards(a, b)`; its code
  landed inside fd12f987, whose message says docs only) and Storm's identity + Weather supports 36002–36005 (37ec8ccd).
- **Also done:** Q50 = A (f1205ada): consequential-damage rules on a card that leaves play mid-attack linger for that
  attack's pending damage (`lingeringDamageRules`), so Coordinated Attack still reduces when it defeats its host.
- **Also done:** Storm's events 36009–36013 (1df8a521). Follow-up: Flash Freeze's "each minion engaged with you" is a
  live query, not a snapshot at play (only differs if a minion engages Storm later that phase).
- **Also done:** Storm's supports, upgrades, allies and 36020 (6b1e4cff; 36018 re-emitted with `maxWithTrait`).
- **Also done:** Havok 36014 and Mirage 36015 (d6fd13e0 engine: consequential damage created from 0, player-attack
  `atkBonus`, `TargetQuery.statCompare`; 7d1b015e cards). Follow-up: a stun target prompt still lists stalwart enemies.
- **Also done:** Storm's obligation + nemesis 36030–36034 (fe185cd3); storm-leadership seats with nothing unscripted.
- **Also done:** Storm is scripted (a201a6e3 engine: a no-controller rule reads `while` with its speaker; 621bfe36
  Claustrophobia; 1a7bfec5 e2e solo/2p with Wolverine/expert + replayed sessions).
- **Also done:** Shadow King modular (6f189f85; boosts only checked for registration, no full game with it).
- **Also done:** MojoMania §3.63 modular pools / per-player set-aside / extra modular Longshot (13756f36), §3.64
  `revealedFromEncounterDeck` (14c68afd), §3.65 villain new face is a full reveal + advance incite + granted peril fix
  (9891ddf5). Notes: on a new villain face, granted incite resolves before its When Revealed (as every other reveal);
  the advance to a set-aside villain counts as a new face (Q36 reading). Client follow-ups: no set-pool picker,
  per-player set-aside count or Longshot toggle on the setup screen yet.
- **Also done:** §3.68 damage by source's printed resource + `doubleDamageTaken` (67c85772; two doublers multiply,
  `attackKeyword` reads only piercing/overkill) and §3.70 play from deck (f8b41107). **Wider change to confirm:** an
  Action event played by an effect is legal only during a player's turn, from any zone (`actionTimingFault`, actions.ts).
- **Also done:** §3.67 `hitPointsReset` (3ac04417).
- **Also done (resumed 2026-10-02, second session):** §3.59 threat on cards that are not schemes (8431a6ce: Hinder X
  on any card type, `on.characterFlips` / `on.characterFlipsOrLeavesPlay`, a hero's `formChanged` targets its identity;
  a flip opens an interrupt window only when an interrupt listens). The `wip/wave-6-3.59` branch is superseded.
- **MojoMania scripting layout** (f81e1e97): `packages/cards/src/wave6/mojo/<set>.ts`, one module per encounter set
  (`crime`, `fantasy`, `horror`, `sci-fi`, `sitcom`, `western`, `magog`, `spiral`, `mojo`, `longshot`), all registered
  in `mojo/index.ts`. An agent fills its own module and `<set>.test.ts` only; the main session adds the set's id to
  `SCRIPTED_SETS.mojo` in `wave6/coverage.test.ts` after reading and running the tests.
- **Also done:** §3.69 `chooseNumber` + `spendResources.distinctTypes` (15edb6df; DSL `chooseNumber(bind, max)`,
  `spendDifferentResources(n, bind)`; 41 engine + 6 DSL tests). Client follow-ups: the number choice shows the generic
  "Choose" title; the spend sheet doesn't show the different-types hint.
- **Also done:** the Sci-Fi genre set (8773dbb1, 13 refs, 24 tests; coverage pin 7f50db5e).
- **Pending owner confirmation, built on the recommended defaults:** Q51 = B (Director's Directions' "spend 2 different
  resources" option is offered only to a player who can pay it; needs a small "can pay" predicate before the Mojo set
  is scripted), Q52 = A (Break a Leg's "any number" is capped at the damage), Q53 = A (two wilds are two different
  resources, as Red Dagger's cost already reads; RRG 1.8 p. 48).
- **Also done:** the Western (8e9cb424), Crime (e1c25c19), Fantasy (36be7689) and Horror (59195c20, 839e3dda) genre
  sets, each read and run by the main session and pinned in `SCRIPTED_SETS.mojo`.
- **Also done:** §3.66 the show deck (04bcd0e0): `ScenarioSeparateDeck.contents.cardIds`, `discardPile: "none"`,
  `closedToPlayerCards`; `CardDestination { scenarioDeck, at }` (DSL `toScenarioDeck(name, at)`),
  `on.encounterCardDiscardedFromPlay(who)`, `lookAtTopOfScenarioDeckThenPlace(name)`; the `spiral` record carries its
  show deck. Scenario decks are now closed zones in `visibility.ts` (also the Experimental Weapons, side-scheme and
  Infinity Stone decks). Client follow-ups: the scenario-deck panel still draws a discard pile for a `"none"` deck;
  `returnedToScenarioDeck` / `scenarioDeckClosed` have no log text. 1A's "1 random SHOW environment" can take the
  topmost SHOW of the freshly shuffled encounter deck (`topmostOnly`).
- **Pending owner confirmation, built on the recommended defaults (§3.66):** Q54 = A (a show-deck card discarded by a
  route 1B doesn't replace goes to the bottom of the show deck), Q55 = A (a "player card effect" is any ability on a
  player card type, identities and Longshot included), Q56 = A (a player card may discard the SHOW environment in
  play; 1B then places it on the bottom).
- **Also done:** Sitcom (b6f9d8af) and Longshot (2d7e9c5a): all six genre sets and Longshot are scripted. The MaGog
  scenario (c0664fd3: 27 refs, 62 card tests, 10 e2e games; the "won" game starts with 4 ratings counters by surgery).
- **Also done, engine fixes** (each changes older cards, see the commit bodies' tests): a granted quickstrike is read on
  engagement (0d89f5ba: The Mojo Files, Brotherhood 32079, Symbiotic Berserker 27121); an enemy attack reads a granted
  overkill (65840174: Wild Wild Mojo now uses `attacksGainKeywords`; Rhino 27128, Black Dwarf, Bulldozer, Badoon
  Warlord, Osborn Tech's and Tech Gauntlets' hosts now spill); a basic attack cannot target an enemy that cannot take
  damage (263b319f, ruling Mar 19, 2026 (2): Ultron III, Loki, Thanos + Sanctuary, Madame Hydra, Goblin 39043, Shadow
  King, Dragnet). Client log lines and prompt titles for §3.59/§3.66/§3.69 (72bd9506).
- **Sitcom's engine gaps (queued, one engine task):** an obligation in a player's area has no controller, so "you" is
  nobody in three places: `leavingSnapshot` (`effects.ts`; Mojo in the Middle's draw), `blankedSets` (`select.ts`;
  Family Matters), `allyLimitFor` (`rules.ts`; The Odd Couple, plus `checkAllyLimit`'s early return for a limit under
  3). Five `it.fails` in `mojo/sitcom.test.ts` flip when fixed. Family Matters' action needs an "exhaust each" cost
  (`KNOWN_SKIPPED.mojo`).
- **Other queued engine work:** target validity doesn't judge the `attack` effect behind attack events (Haymaker still
  lists a Dragnet-protected villain; ruling Apr 30, 2026 (1); small code, moderate test churn); the Q51 "can pay"
  predicate (before the Mojo set); `endGame` has no `cardAbility` reason (MaGog's crowd win/loss is labeled
  `villainDefeated` / `mainSchemeCompleted`; matters if the client shows the reason); the defend preview's ranged reads
  only the enemy's own keyword.
- **Client gaps (not built):** the scenario-deck panel draws a discard pile for a `discardPile: "none"` deck; no threat
  badge on a character or obligation card; the spend prompt shows its requirement only in the title; setup screen has
  no modular-pool picker, per-player set-aside count or Longshot toggle.
- **Also done:** the Spiral scenario (1772b9c6: 23 refs, 54 card tests, 6 e2e games; the "won" game starts with
  Spiral II Cornered at 1 hit point by surgery, the greedy driver can't win it alone). One `it.fails`: The Search for
  Spiral's own Hero Action removing its last threat reveals nothing, because a `removeThreat` event names no player
  and the action's source is the scheme (same family as Sitcom's obligation "you"; queue with that engine task).
- **Also done:** §3.60 (5ec3597b): an encounter deck resets at the move that empties it and announces
  `deckRanOut { deck: "encounter", deckId }` when an ability listens (DSL `on.encounterDeckResets(deckId?)`). Five
  engine stub tests changed (the deck is now full and the token placed right after the emptying move). Follow-ups:
  `revealTopOfEncounterDeck` with `then: "discard"` and a count above 1 runs on into the new deck; no client log line
  for an encounter `deckRanOut`. Logs saved before this commit that passed through a reset no longer replay (Q38).
- **Also done:** QA regressions for the older cards the quickstrike/overkill fixes changed (48329b35, 12 tests). Loose
  ends: Tech Gauntlets 24040's data `statModifiers: { atk: 1 }` isn't in its text box (check the scan); the Venom
  villain attacked twice in one phase in the Arm Cannon test (not investigated).
- **Pending owner confirmation, built on the recommended defaults (§3.60):** Q57 = A (an encounter deck that empties
  while its discard pile is empty waits, and resets with one token when a card reaches the discard pile; RRG p. 17's
  literal "the players lose" loop is not implemented), Q58 = A ("After the encounter deck resets" resolves right after
  the engine step that emptied it: before the revealed card's When Revealed, after a whole multi-player deal step).
- **Also done:** §3.61 `villainStepStarting { step: "dealEncounterCards" }` (9a9b7c0a; DSL `on.villainStepStarting()`,
  interrupt window only) and §3.62 `shuffleInSetAsideModularSet { reveal?, placement? }` (b7021917; DSL
  `revealFromSetAsideModularSet(query, { placement })`; `setAsideModularSetCount` already existed). No existing test
  changed. Engine rows 43–54 are all in: the Mojo scenario is unblocked.
- **Also done, DoD §4b custom decks** (a real public MarvelCDB list per hero, imported, legal, seeded game replayed):
  Cyclops 59368 (2416288e), Wolverine 60381 (1ed38674), Phoenix 23099 (293661e5 + ae968479), Storm 67363 (81260ee1),
  Colossus 23121 (ad37bed8), Shadowcat 23153 (d5991b49). Each file also pins `requiredIdentitySet` and a `validateDeck`
  message. Decklist caches for Gambit and Rogue later: session scratchpad `all/` (2025-12 → 2026-10) and `older/`
  (2022-10 → 2023-07); a fresh session re-fetches from `/api/public/decklists/by_date/YYYY-MM-DD.json`.
- **Hero art in** (8db741b3): Colossus, Shadowcat, Phoenix now in `art/heroes/`; new Psylocke and X-23 portraits.
  (Local history shows the art added in 244cc721, reverted inside d5991b49 by a stale shared index, restored in
  8db741b3. **Lesson:** a temp-index commit that deletes or moves files must resync the shared index for those paths
  (`git reset -q HEAD -- <paths>`) at once, or the next agent's no-pathspec commit reverts it.)
- **Pending owner confirmation, built on the recommended defaults (§3.61/§3.62):** Q59 = A (the start of step three is
  interrupt-only), Q60 = A (the first player reveals the SHOW chosen by 1B / the Wheel), Q61 = A (hazard icons are
  counted after the step-three interrupt), Q62 = A (Wheel STOPPED with no set left still deals 2 and flips).
- **Also done:** "you" on an uncontrolled encounter card (16f0a28f: an obligation's leaving player, blank rule, ally
  limit with a forced discard under 3; 5829dcea: `removeThreat.playerId`, read as `eventPlayer`); the Mojo scenario
  (e91e450b); an "exhaust each" cost (a86700bb, Family Matters) and a "can pay" option gate (82c3113a,
  `canPayResources` / `canSpendDifferentResources`; Director's Directions gated in 3e48923f). **MojoMania is fully
  scripted.** Not fixed, reported by 16f0a28f's agent: other `controllerOf(sourceId)` readers where "you" on an
  obligation is still nobody (`countsAs`, trait/keyword grants, state-check `when`, `triggerableBy`, most `rules.ts`
  readers, the crisis check for a player using an encounter card's action, `characterDefeated.defeatedByPlayerId`);
  no printed card is known to hit them.
- **Also done:** the MojoMania campaign (0822cdb8, §3.72): `MOJO_CAMPAIGN` (hand-authored `data/mojo/campaign.ts`),
  `campaigns/mojo.ts` with 49 unit + 4 QA tests (QA games staged as the scenarios' e2e files are). `validateCampaign`
  now accepts an empty `campaignSetIds`. The campaign owns the modular-set picks (`mojoModularSetPicks(log)`); a client
  must pass them to the builder (not wired yet). **Box code:** MC39 (FFGMC39EN), confirmed by the owner from the box.
- **Art:** new Gambit portrait; villain art for Sabretooth, Project Wideawake, Mojo in `art/scenarios/_pending/`
  (6515e9de) until step 5 adds wave 6 to the client pool (`POOL_SCENARIOS`).
- **Pending owner confirmation, built on the recommended defaults:** Q63 = A (a player using an ability on another
  player's card is the one who removed the threat), **Q64 = B, decided by the owner** (an encounter card's forced removal of The Search
  for Spiral's last threat: the first player reveals; 4d6d24a5), Q65 = A (an
  encounter attachment leaving a player's card names that card's controller), **Q66 = B, decided by the owner** after RRG p. 14 was quoted (a
  player using an encounter card's own action is not stopped by crisis; a player-scoped "threat cannot be removed"
  rule still binds them; b3cf6f7b + 69a21944), Q67 = A
  (Curtain Call's tie: the revealing player picks), Q68 = A (Longshot declined at campaign setup is left out), Q69 = A
  (the first player is "one player" who reveals him), Q70 = A (an X-cost card is recordable, counted as 0), Q71 = A
  (the recorded card's printed cost), Q72 = A (scenario 1's set pick offers only the six genre sets).
- **Also done:** Gambit rows §3.52 (7cfc4016: `playNote`, `modifyCardEffect` builder) and §3.53 (cda56791
  `placeCountersCost`; 70aaf989: an "up to N counters" cost asks how many inside a timing window, 1..min(N, held),
  RRG p. 14 "requires a minimum of one"). Owner decisions Q64 (4d6d24a5) and Q66 = B (b3cf6f7b + 69a21944).
- **Also done, client:** MojoMania in the app pool (37058468); setup labels and the set-aside reveal log line
  (f0896aa4). **Seen in the browser** (headless, real clicks, clean clone on :5184 with `?unlock=all`): Scenario select
  → Mojo → seats → Set the table → deal → board → a full round through the villain phase, no errors; 1B brings one set
  in at setup as printed. Still to fix (client): the Scenario select bottom bar's Mojo encounter-set text wraps and is
  clipped; Set the table's "Encounter deck" summary text is squeezed small; Mojo's genre-set chips look pickable but do
  nothing. Owed: threat badges on characters/obligations and the set-aside readout (running), a genre-set picker, an
  "Include Longshot" toggle, the show-deck panel without a discard pile, ratings counters on the crowds, MaGog and
  Spiral villain art (they fall back to card scans).
- **Browser checks while agents edit:** the dev server reloads the page on every file change in the shared tree;
  serve a `git clone --local` of the branch on another port instead.
- **Also done:** Gambit's engine rows §3.54 (ffa99f19, `encounterLookDiscardCost(look, discard, slot)`) and §3.55
  (9d89ac5c, `modifyThwart({ extraThreat })`); Gambit's folder + identity (e1087204, `gambit/gambit/`, helper
  `gambitGame` in `support.ts`); Rogue's §3.48 find (8498db74, `findCard(q, to, { owner, bind })`, `find(q)` ref).
  Client: threat strip on non-scheme cards (55066ac8), set-aside footer (4eb91ee9), MojoMania polish (5766cf6d), the
  **MojoMania campaign on the Saga shelf** (b8ecee36: Vol. 6, MC39; NeXt Evolution onward renumbered 7–10; signed and
  played to issue #1's board in the browser; issues #2–#3 by tests only; no story file, so the opener skips to the
  briefing). Gambit/Rogue card-data fixes from §6.2 were already in (2f17a494, 76a2b947; §6.2's list is stale).
- **Pending owner confirmation, built on the recommended defaults:** Q73 (§3.53) the "how many counters" prompt can't be
  backed out of, options listed most-first; Q74 (§3.54) looked-at encounter cards stay table-visible until networking
  (Phase 5); Q75 (§3.54) a look-and-discard that empties the deck puts the discarded card in the new deck; Q76 (§3.55) a
  thwart cancelled after Operative Skill keeps its counter spent; Q77 (§3.48) a find that finds nothing shuffles
  nothing, takes the first copy in search order, can't find a card mid-resolution, shuffles right after the move.
  **Open, not built:** Q78 (§3.55) Operative Skill on a multi-scheme "(thwart)" ability: recommended A, trigger once and
  the player picks the scheme for the extra (today: once per scheme; needs an engine change).
- **MojoMania content the owner could supply:** a campaign cover (`art/campaigns/mojo/`), story text
  (`packages/client/src/campaign/stories/mojo.ts`: tagline, blurb, openers, briefing lines, finale), villain art for
  MaGog and Spiral (`art/scenarios/<id>/villain.*`; they show card scans), music.
- **Running now:** engine §3.49 (Rogue row 60); Gambit's events; Gambit's supports/upgrades/allies. Then Gambit's
  obligation + nemesis, Gambit's precon e2e + custom deck, Rogue rows §3.50, §3.51, §3.56, §3.57 and Rogue's
  scripting, the Exodus and Reavers modular sets, the remaining role upgrades (§3.82, §3.83), Titanium Muscles
  (§3.78), target validity for attack events, QA docs, Guided mode (DoD §5).
- **Owner feedback on the Mutant Genesis briefing (2026-10-03, from a phone):** (pass 1, running) each seat's call
  shows that seat's hero portrait and name; roles explained (aspects, a plain summary, what role upgrades and
  role-building do) with a confirm step before a role is recorded. (Pass 2, next, after pass 1 lands: same file)
  role-building's offered cards shown as card pictures, each opening the existing **Inspect** pop-up (tap / long
  press, as on the board) so the card can be read in full; cards recommended for the seat's role and aspect marked
  with a one-line reason.
- **Engine bug queued (after §3.50):** a "take damage" cost counts as paid when tough prevents it; RRG p. 14 says
  it isn't paid. `takeDamageCost` (`AbilityCost.damageSelf`, `actions.ts` ~2268) pushes a bare `dealDamage` instead
  of going through `settleCostDamage` (`cost-damage.ts`). Pinned `it.fails` in `wave6/mojo/qa.test.ts`; affects
  Focused Rage (FAQ #27), Wolverine's Claws, Tower Defense, Ronan, Obedience Potion, Venom, Gamora's nemesis.
- **Done since:** briefing pass 1 (2ad9e0b3) and pass 2 (8a8844fb: card pictures, Inspect from the phone sheet, "Take
  this card", confirm, recommendations); the take-damage cost fix (3d004785); Q81 Barrage (3bc5b946); engine §3.50
  (43003575), §3.51 (9c8b1d33), §3.56 (c8aad58b); Rogue identity (d6377f87) and events (254d6b45); QA passes for
  MojoMania, Cyclops/Phoenix, Wolverine/Storm, Mutant Genesis scenarios (c1c2aae4).
- **Engine queue after §3.57 (one small commit each):** (1) `TargetRef { kind: "activatingEnemy" }` (innermost
  `enemyAttack`/`enemyScheme` frame), then the Brotherhood boosts' extra card only when the named villain activates
  (pending default Q82, ruling Feb 28, 2026 (6) by analogy; `it.fails` in `wave6/mut_gen/qa.test.ts`); (2) a played
  event goes to its OWNER's discard pile (`play-card.ts` uses `frame.playerId`; RRG p. 31; `it.fails` in
  `wave6/rogue/rogue/events.test.ts`, Superpower Adaptation / Q29); (3) a cost removing ALL counters of a type with
  no choice (Bishop 37011's interrupt, `KNOWN_SKIPPED.gambit`).
- **Pending defaults added:** Q82 above; Superpower Adaptation's search runs as an effect (playable with nothing to
  find) until a cost can read another player's discard pile; Q-3.56a a form-change trait clause reads the face left.
- **State on 2026-10-03 (4ef29ce8):** the 64-row engine queue is done; MojoMania, Gambit and Rogue are scripted
  (Rogue's Med Lab pending); the engine follow-ups landed (05563d10 `activatingEnemy` + Brotherhood boosts, 6a765c7a a
  played event to its owner's discard pile, 331b1402 `removeAllCounters` + Bishop, 3b859fd8 `refCount`/`tuckedCount`,
  d24882ef a hand-active encounter card stays in hand); QA passes done for every pack except the MC32 campaign.
  Commit 9928b94a's subject says "docs" but it also carries Rogue's obligation, nemesis set and last events (two
  agents had staged files at once). Full check green: content 678 / engine 2607 / cards 6659 + 4 expected fail + 1
  todo / client 3083. The briefing shows each seat's deck aspect (bac6a44e). American spellings from now on (owner).
- **Owner priority: no skipped cards.** Remaining skips, all wave 6, each needing a small engine piece built and
  the card scripted in the same commit: Med Lab 38028 (a `while` gate on responses, ad2a22ba) and Titanium Muscles
  32005 (a resource per tough status card, 00c29eb5): done, with pending defaults Q83-Q86 (Titanium Muscles may be
  exhausted for 0; Med Lab takes any player's ally; Med Lab tucks the ally from wherever its defeat sent it; tough
  cards are counted even when inactive). Boom Boom 32090 (5bdfb8cc) and Compassion 32182/32192
  (ba578b0f, `divide("heal", …)`): done and pushed, with pending defaults Q87-Q90 (Boom Boom's end-of-phase blast is a
  delayed effect of her Response; an enemy her attack defeated gets no counter; Compassion heals as much of the 3 as
  damaged characters hold; it still draws and removes itself with nothing to heal). Running: Determined Defense 32189
  (an attack that removes threat instead of dealing damage), the last skipped card. One engine agent at a time.
  Full check on ba578b0f: content 678 / engine 2640 / cards 6704 + 3 expected fail + 1 todo / client 3084.
  Villain art for every wave 6 scenario is in (b21c848d). The owner's American-spelling commit is merged (7dd809fd).
- **Bugs found by QA, queued:** Steel Fist 32008's "(attack)" label (erratum p. 68): fixed in b5d7e726; a prevented
  piercing attack doesn't discard the tough card (ruling Jan 17, 2026 (3) #1: Bulletproof Belle, and Shadow and Steel
  by analogy; `resolve/event.ts` returns before `pierceTough`; `it.fails` in `rogue/qa.test.ts` and
  `colossus/qa.test.ts`); `src/campaigns/mojo.qa.test.ts` times out under full-suite load (passes alone): raise its
  timeout or lighten it. Still open from earlier: Robert Kelly attached to a scheme (§3.75), Mutant Protectors FAQ
  #17, target validity for attack events, Q78 Operative Skill on a multi-scheme thwart.
- **QA flagged for the owner:** Q2 (teamwork before When Revealed) differs from RRG p. 43 and the ruling names
  quickstrike only; it changes the Reavers' first attack (ATK 2 vs 3). Already an owner decision; listed for review.
- **Push by sha** (`git push origin <sha>:feature/wave-6`): a plain push of the branch also sends any agent commit that
  landed since the last check.
- **Next, in order:** Storm's obligation +
  nemesis, precon e2e; then MojoMania (§3.59–§3.73, §8 rows 43–51; its campaign §3.72, Q33), Gambit (§3.52–§3.55),
  Rogue (§3.48–§3.51, §3.56, §3.57); the remaining role upgrades (§3.82 Compassion, §3.83 Determined Defense);
  Titanium Muscles (§3.78); then QA docs, Guided mode coverage (DoD §5), the MarvelCDB decklist fixtures (§4b).
- **Waiting on the owner:** a Captive ally's card back (Rictor).
- **How each push is checked:** `pnpm check` on a clean local clone (`git clone --local` into the session scratchpad,
  `pnpm install --offline --frozen-lockfile --ignore-scripts`), because agents' uncommitted files sit in the shared tree.

## Decisions made by the user during the wave

None yet; the spec's §4.1 table will hold them.

## Owner walk-through of the pending defaults (2026-10-03)

Determined Defense 32189 is scripted (0d03e604): no wave 6 card is skipped any more. The owner then answered every
pending default. "Built" means no change is needed.

- **Confirmed as built:** Q51 (unpayable option not offered), Q52, Q53, Q55 (any player card type, identities and
  Longshot included), Q56, Q60 (first player), Q61 (hazard icons counted after the Wheel resolves), Q63, Q65, Q70, Q71,
  Q72, Q75, Q76, Q82, Q83, Q84, Q86, Q87, Q89, Q90, and Determined Defense's amount (damage after DEF).
- **Q78 decided:** a "(thwart)" ability hitting several schemes is one thwart, but an "additional threat" modifier
  (Operative Skill) increases each instance of threat removal. Matches today's per-scheme behavior; a test pins it.
- **Changes decided, to build (one small agent each, engine ones one at a time).** The owner's answers came from
  ChatGPT; each was then checked against RRG 1.8, the rulings file, the printed cards and the insert, and the owner
  chose to follow the rules wherever an answer conflicted.
  1. A "(thwart)"-labeled ability is a real thwart (RRG p. 26 "Labeled Ability", p. 32 "Patrol"): patrol stops it on
     the main scheme, thwart modifiers apply, "after you thwart" hears it. Align Psychic Manipulation, Heroic
     Intervention, Mentorship and the like. Running.
  2. Determined Defense cannot be triggered while the main scheme is not a valid thwart target (crisis, patrol;
     RRG p. 43 "Target", Wasp FAQ). Running (same agent).
  3. Q57: encounter deck and discard pile both empty: the players lose (RRG "Encounter Deck", infinite loop).
  4. Q58: "after the encounter deck resets" resolves right after the reset, in the middle of a deal, before the
     remaining cards are dealt.
  5. Q67: Curtain Call's tie is broken by the first player (RRG p. 19).
  6. Q69: the players choose who reveals (and controls) Longshot at campaign setup (owner's call; RRG p. 19 would
     say the first player).
  7. Q74: a "look at" is private to the looking player, in hot-seat play too (RRG "Look At"; client).
  8. Q77: a deck that was searched is shuffled even when nothing is found (RRG "Search").
  9. Q54: a show-deck card discarded with no replacement applying goes to the encounter discard pile (owner's call;
     no rule covers it).
  10. Q68: at a later scenario's setup, Longshot not revealed is shuffled into the encounter deck (insert: "one
      player may reveal him. Otherwise, shuffle him into the encounter deck"), never left out.
- **Kept as built, following the rules over the ChatGPT answer:** Q59 (the Wheel's STOPPED side is a Forced
  Interrupt), Q62 (no loss clause on STOPPED; unreachable), Q73 (RRG p. 14: an "up to" cost requires a minimum of
  one), Q85 (Med Lab takes an ally from any in-game out-of-play area, a hand included; ruling Dec 17, 2025 (4)),
  Determined Defense used while confused stays in play (RRG p. 26: everything but the cost is canceled), Q88.
- **Also owner-supplied today:** villain art for every wave 6 scenario; Sabretooth's three tracks (The Savage Hunt,
  The Predator's Prize, The Beast Declawed); the Mutant Genesis interlude (Back at the Mansion); Sabretooth's one-off
  intro artboard with dialog (949b9447).

## State at the end of 2026-10-03

Everything on the owner walk-through's "to build" list is built: "(thwart)" is a real thwart (7452f90c) and
Determined Defense is not offered under crisis or patrol (f1f75a60); Q57 (6f5d0ec3, cfdf6d92), Q58 (c7fea75a), Q67
(477475c5), Q68 and Q69 (61592256), Q74 (8f73c7d7, 6fb53822), Q77 (aae1a7ba; four older cards that never shuffled
after a search were fixed with it), Q54 (528afd17). The three pinned engine gaps are closed: piercing discards tough
before prevented damage (3c955206), Mutant Protectors announces the ally alone and the hero takes over if the ally
leaves (27320e9d), the final stage's When Completed resolves before the loss and Robert Kelly's pins are real
(74b3d4ef). No `it.fails` is left in wave 6.

- **Also built today:** MojoMania client gaps (genre-set picker with Random, Longshot chip, scenario-named tiles, show
  deck panel, counters in Inspect, log lines, phone environments); Guided mode (glossary, tips, Inspect notes, six
  Try-it lessons, "New in each box" pages in How to play from an `introducedIn` tag); the MC32 campaign rules-QA pass
  (`docs/phase7-wave6-qa-mutgen-campaign.md`); Storm's cross-hero test; Team-Up splash, ring on the hero panels, TEAM-UP
  tags on cards and completing allies, an Inspect alert, and pictures for all eleven playable pairs
  (`docs/team-ups.md`); the Sabretooth one-off intro; Sabretooth's and Mansion Attack's three tracks each and the
  Mutant Genesis interlude; villain art for every scenario. Main was merged in (08a82d28, #95).
- **Lesson:** fetch `origin/main` before each push and merge it when it has moved; the PR went "conflicting" when
  Guided mode touched files #95 had changed. Long seeded game tests need explicit timeouts (three timed out only
  while three agents ran suites at once).
- **New pending defaults (built the recommended way, for the owner):** an attached Robert Kelly can be chosen by a
  player card that says only "an ally"; "cannot take damage" keeps the tough card against piercing (the ruling covers
  "prevent"); a tough card given by a "would take damage" interrupt after piercing resolved stays; Mutant Protectors'
  hero takeover opens "when you defend" interrupts too; Psychic Manipulation stays playable while patrolled or under
  crisis (nothing is removed) while Determined Defense is not offered; non-"up to" divides still offer a main scheme
  that cannot be thwarted; "after you thwart" is heard once per scheme on a multi-scheme "(thwart)"; an ownerless find
  with no copy in the game shuffles every deck; seven Setup searches of the encounter deck have no shuffle; Wrecking
  Crew's both-empty loss is per villain deck.
- **Done since (2026-10-09, PR #106):** `divide("threat")` now adds the `modifyCardEffect` threat bonus to each scheme
  given a share (Shrink FAQ), and the unused `returnedToScenarioDeck` event is removed.
- **Follow-ups not done:** "(attack)" labels on Hit and Run 18020 and First Hit 18015 deal damage with `dealDamage`, not as an attack;
  Kang's Wrath 4B's new
  shuffle has no dedicated test; the Team-Up ring has no keyboard focus stop (T opens the panel) and its panel does
  not scroll; the "Other heroes" row truncates its second line beside the ring.
- **Left for the wave:** Guided mode follow-ups from the owner (entries under both Core and their box, Titanium
  Muscles as a resource in Inspect and in the lesson, lesson steps waiting for the villain phase: running), a
  MarvelCDB deck imported and played in the browser (DoD §4b), step 8 (clean-clone `pnpm check`, CI), and content the
  owner may still supply (music for six scenarios, two campaign finales, the MojoMania campaign cover).

## State on 2026-10-04 (after the overnight QA)

Everything below is pushed. Full check on e1315157: typecheck, lint, format; content 690 / engine 2748 / cards 6922 /
client 3417, nothing expected to fail; e2e 52 of 52 locally; the 192-game hero-by-scenario soak passes.

- **Built since the last section:** the three thwart decisions (5e87b973, ccecc559, 04c4af21); the `sameNameHeroAllyConflict`
  table rule (f89b524f) with the client setting, the seat-screen prompt and replacement picker (0596aa6e, 95f1e40f,
  42d2447c: signature cards are never swappable; in a campaign the sheet opens only on "Sign & open"); Team-Up on the
  seat screens and a shared recommendation model (db95b9de, 206f6537, 263d06c9, 980823bc: the Recommended shelf is the
  first real shelf, collapsed by default on a phone); MojoMania's story file, default cast and briefing, and the two
  comic pages (96be7db2 …, 8bb56d46, cec940e6); wrap-not-truncate fixes; e2e specs for campaigns, scenarios, Team-Up,
  How to play, MojoMania setup, deck import, the look cover and the same-name prompt, run in CI as four shards
  (99016da7); rules-QA regressions and the soak (9ecba9ae, 39634378); three browser playthroughs with their defect
  tables (`docs/phase7-wave6-qa-playthrough-{a,b,c}.md`) and the fixes for them (390fa122 … e1315157).
- **Owner UI rules (2026-10-03):** wrap a short label rather than cut it with an ellipsis, but keep on-screen text to
  a few words (two lines at most); longer text belongs in Inspect. A row of half-height tiles reads as bolted on: new
  shelves use the real shelf.
- **Lessons:** a spec must wait on states and re-press a button until the next screen is up (a single early press is
  lost on a slow runner); prove new specs with `E2E_CPU_THROTTLE`; while several agents commit in one worktree,
  `git commit -- <file>` takes the whole file, so two agents must not have edits in the same file (fa70f24b swept
  another agent's lines); agent claims of "nothing cropped" need the main session to open every screenshot.
- **Waiting on the owner:** Psychic Manipulation is now not playable under patrol or crisis (same rule as Impede):
  confirm; whether the same-name prompt at the start of four default-cast campaigns is acceptable; whether the Shadow
  King modular set (Storm's pack) should be offered at Table setup; whether a hero should count for a Team-Up while in
  alter-ego form (built: face-up side only); the comic opener's panel framing (improved, still shows neighboring
  panels); content: art for MojoMania issues 2 and 3, a campaign cover, music for six scenarios and two finales, an
  unstamped Gambit portrait.
- **Not verified in a browser:** the Game Over wording for card-caused losses (unit tests only); the lost-tap fix
  (6b486e2a); the "order these effects" change for Temporary upgrades; the Mutant Genesis campaign past issue #1 and
  the campaign log between issues; phone games for Rogue, Shadowcat and Wolverine beyond the opening turn.

- **Owner decisions, 2026-10-04:** Psychic Manipulation and Brainstorm are not playable under patrol or crisis (RRG
  pp. 24, 43; built; this replaces Q17's "playable, nothing placed" for the printed card). Team-Up: the ring and pair
  marker show whenever both characters are in play in either form, but a Team-Up card is played by the RRG (both
  showing their hero side), with the tag and Inspect naming what is missing: to build in the client. Piercing against
  "cannot take damage" keeps the tough card (built). A player card that says only "an ally" may choose Robert Kelly
  while he is attached to the scheme (built). Still open: which modular sets Table setup offers, the same-name prompt
  for default casts, the Recommended shelf's phone default (PR description, questions 6 to 8).
