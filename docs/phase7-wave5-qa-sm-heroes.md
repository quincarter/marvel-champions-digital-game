# Phase 7 wave 5 rules-QA pass — Sinister Motives box's two heroes (Ghost-Spider, Spider-Man/Miles Morales)

`rules-qa-engineer` independent QA pass over Ghost-Spider (`sm` 27001a–27029) and Spider-Man / Miles Morales (`sm`
27030a–27060) only, modeled on `docs/phase7-wave5-qa-spdr.md`. Scope: `packages/cards/src/wave5/sm/ghost-spider/*.ts`,
`packages/cards/src/wave5/sm/spider-man-morales/*.ts`, the two heroes' own slice of
`packages/content/src/data/sm/cards.ts`, and `packages/cards/src/wave5/sm/cross-hero.test.ts`'s two describe blocks
that exercise their aspect/basic cards from a Core hero's deck.

## 1. Card-by-card audit

All 29 Ghost-Spider cards (27001a/b, 27002–27029) and all 31 Miles cards (27030a/b, 27031–27060, minus the
never-printed 27051–27053 basic resources, which carry no ability and are data only) read against
`packages/content/src/data/sm/cards.ts`'s printed text, the card scans under `assets/card-art/bundles/cards/`,
RRG 1.8, and `marvel-champions-rulings-post-rrg-1-7.md` (grepped for "Ghost-Spider", "Gwen", "Miles Morales", "Venom
Blast", "Spider Camouflage", and every other card name in both kits — the transcript carries no ruling specific to
either hero; every non-obvious call for these two heroes instead comes from the wave 5 spec's own decided questions,
§2 below).

**Every ability's own script already carries a docblock that ties its reading line-by-line to the printed text and
cites the exact RRG page/spec question for every non-obvious call** — the same standard the SP//dr, Ironheart and
Nova passes found. Spot-checked directly against the card scans (not just `text.printed`/`text.current`) for the
trickiest cards in each kit: Spider-Man/Miles's two Specials (27030a, "Venom Blast"/"Spider Camouflage" — scan
matches `text.printed` verbatim, word for word including the em-dash before "Special"), In Cold Blood (27029, the
"You cannot play events until after that attack resolves" restriction — scan matches exactly), Spider-Man/Peter
Parker (27049, the multi-icon Requirement `[energy] [mental] [physical]` — parses correctly into
`keywords: [{ name: "requirement", resources: { energy: 1, mental: 1, physical: 1 } }]`, unlike Silk's own drop,
§4.1 Q61). No wording drift found between any scan and its `text.printed`.

Every ability id named in a card record's own `abilities` array is exercised by at least one test in the matching
`*.test.ts` file, with one confirmed exception that is not a gap: Parental Guidance's (27003) two bullet-line refs
(`27003.parental-guidance-constant`/`-constant-2`) are `coveredByEngineRule()` stubs — the card's real behavior lives
entirely in `.parental-guidance-action`, which _is_ tested (`events-a.test.ts`) — the same "id exists for the card
data's own two-bullet parse, but nothing behavioral is attached to it" shape SP//dr's own identity flip refs use.

Three things worth calling out precisely, none of them requiring a fix:

- **§4.1 Q59 (In Cold Blood's "You cannot play events until after that attack resolves" needs `applyRuleUntil` to
  last until the end of an attack) is built and tested, though the spec's own table still lists it "open".**
  `ghost-spider/obligation-nemesis.ts`'s `27029.when-revealed` writes `applyRuleUntil({ kind: "cannotPlay", … },
"endOfAttack", …, { attack: "initiated" })` before the `enemyAttack` it gates, exactly as the docblock prescribes,
  and `obligation-nemesis.test.ts`'s "Backflip cannot prevent The Lizard's attack" test proves both halves: Backflip
  (a Hero Interrupt event) is refused during the attack it names, and the restriction is gone
  (`lastingEffects.some(e => e.rule.kind === "cannotPlay")` is `false`) once that attack resolves. This is a stale
  spec-table entry, not a real open item — flagged back rather than silently left for someone to trip over.
- **§4.1 Q63 (a `resolveSpecials` caller must resolve only the Special it names, not every Special on the card) is
  scripted exactly as decided and stress-tested by stacking, not just isolation.** Both `resolveSpecialsOf(...,
{ abilities: […] })` call sites (`events.ts`'s Web-Shot/Swing In, `support-upgrades-allies.ts`'s Power
  Within/Defense Mechanism) pass an explicit single-ability filter, and every one of their four tests asserts the
  _other_ Special's absence in the same breath as the named one's presence (no stray tough/confuse from Web-Shot, no
  stray damage/stun from Swing In, and the mirror image for Power Within/Defense Mechanism) — a real negative case
  per card, not just "something happened". The `e2e.test.ts` scripted game goes further: it fires Venom Blast twice
  in one round (once via Power Within, once via Web-Shot paid with `[energy]`) and confirms the villain's stun
  status is not double-applied on the second hit (RRG 1.8 "Status Cards": non-Steady characters cap at one status of
  each type) while its own damage still lands twice — the interaction a single-firing isolation test would never
  catch.
- **§4.1 Q60/Q61 (a `reorderCards` primitive for a player deck; the multi-icon Requirement ingest fix) are both
  built and exercised on these two heroes' own cards** — Global Logistics (27043, Miles's own event) for Q60, with
  a dedicated test for the "kept card sent to the bottom instead of the top" branch (`events.test.ts`); Spider-Man/
  Peter Parker (27049) for Q61, exercised as a real payment in `cross-hero.test.ts` (§1 above).

## 2. New tests added this pass

1. **`packages/cards/src/wave5/sm/ghost-spider/e2e.test.ts`, "Rhino (expert), solo: Ghost-Spider"** and
   **`packages/cards/src/wave5/sm/spider-man-morales/e2e.test.ts`, "Rhino (expert), solo: Spider-Man (Miles
   Morales)"** — the wave definition of done's "one expert game … to an outcome, replay deep-equal" requirement
   (both packs had a solo standard game, a hand-scripted standard game and a 2-player standard game, but no expert
   game, before this pass). Modeled directly on `wave5/nova/e2e.test.ts`'s "Rhino (expert), solo: Nova" (itself
   modeled on `wave4/hood/e2e.test.ts`): `<x>Scenario("rhino", { seed: SEED, difficulty: "expert" })`, played to a
   real outcome by the card-name-agnostic greedy driver, replayed and asserted deep-equal against the live session
   state. Confirmed passing directly against `WAVE5_DEPS`.
2. **`packages/cards/src/wave5/sm/ghost-spider/support-upgrades-allies.test.ts`, "27009.web-bracelet-response +
   27001a.ghost-spider-constant (Dizzying Reflexes): both fire off the same shared trigger"** — a real card-vs-card
   interaction gap. Web-Bracelet (27009, upgrade) and Ghost-Spider's own identity ability "Dizzying Reflexes"
   (27001a) listen for the _identical_ trigger (`onInterruptOrResponseResolvedOnEvent`, shared and named as such in
   both cards' own docblocks — `support-upgrades-allies.ts` line 92 says so explicitly), but before this pass no
   test ever drove both abilities live at once: `identity.test.ts`'s own Dizzying Reflexes test never plays
   Web-Bracelet, and this file's own preexisting Web-Bracelet test never named Dizzying Reflexes' own ability id in
   its picker, so that offer silently fell through to `firstLegal`'s decline path rather than being proven to
   resolve. The new test plays both, accepts both offers explicitly, and asserts both effects land from the one
   underlying `abilityResolved` event: Web-Bracelet exhausts and draws a card, and Dizzying Reflexes readies
   Ghost-Spider — passing cleanly, confirming the engine's simultaneous-resolution handling (RRG 1.8 "Simultaneous
   Resolution", p. 40) already gets this right; this was a coverage gap, not a bug.

## 3. Engine/script gaps found

None. Both kits' scripts, ability coverage, and the two areas this pass targeted specifically (isolation-only
interactions, the Specials) held up under closer testing. The one issue found (§2.2, Q59's stale "open" status) is a
documentation drift in the spec table, not a behavior bug — routed below rather than fixed here (out of this pass's
remit: "don't edit the spec's status columns or open questions").

## 4. What this pass did not do

- **Did not re-audit Nova, Ironheart, Spider-Ham, or SP//dr** — out of this pass's stated scope (Ghost-Spider and
  Spider-Man/Miles Morales only).
- **Did not touch `packages/cards/src/campaigns/`, `packages/engine/src/campaign*`, or any client file** — another
  agent's scope either way, and explicitly out of bounds for this pass.
- **Did not audit `cross-hero.test.ts`'s own coverage of the other four wave 5 heroes' aspect cards** sharing that
  file (Nova/Ironheart/Spider-Ham/SP//dr's own describe blocks) — only the Ghost-Spider and Miles describe blocks
  are this pass's own two heroes' cards.
- **Did not open a diagnostic/throwaway harness** — every claim and test in this pass ran directly against real
  `WAVE5_DEPS` (`pnpm --filter @mc/cards exec vitest run src/wave5/sm/ghost-spider src/wave5/sm/spider-man-morales
src/wave5/sm/cross-hero.test.ts` — 16 files, 141 tests, all passing before and after this pass's own three
  additions).

## 5. Findings routed elsewhere

1. **Spec-table drift: §4.1 Q59's "Work" column still reads "open" in `docs/phase7-wave5.md`, but the primitive it
   describes (`applyRuleUntil` lasting until the end of an attack) is built and tested** (§1 above,
   `ghost-spider/obligation-nemesis.ts`'s `27029.when-revealed`, `obligation-nemesis.test.ts`'s Backflip test). Not
   a behavior bug — the main session should update the table cell (this pass does not edit spec status per the
   worktree rules).

No `game-rules-architect`/`ability-scripting-engineer`/`encounter-ai-designer` bugs found this pass, and no new
rules question for the user. Both kits' Specials (Q63) and In Cold Blood's attack-scoped restriction (Q59) are built
and tested exactly as decided, including the stacking/negative cases isolation testing alone would have missed; the
one real gap found (§2, Dizzying Reflexes + Web-Bracelet) was a coverage gap in an already-correct engine behavior,
now closed.
