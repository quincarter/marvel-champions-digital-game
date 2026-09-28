# Phase 7 wave 5 rules-QA pass — SP//dr pack

`rules-qa-engineer` independent QA pass over the SP//dr pack only (docs/wave-definition-of-done.md §4), modeled on
`docs/phase7-wave5-qa-ironheart.md`. Scope: `packages/content/src/data/spdr/cards.ts` (31001a/b + 31002/31002b, one
separated identity spanning four faces, plus 36 other cards: 31003–31037) and `packages/cards/src/wave5/spdr/*.ts`
(identity, events, allies, support-upgrades, obligation-nemesis, sinister-syndicate).

## 1. Card-by-card audit

All 37 SP//dr cards (31001a/b, 31002/31002b, 31003–31037) read against `packages/content/src/data/spdr/cards.ts`'s
printed text, the card scans under `assets/card-art/bundles/cards/`, RRG 1.8 (including its own FAQ entries, e.g.
"Spider-Man Noir (#15)", p. 63), and `marvel-champions-rulings-post-rrg-1-7.md` (grepped for "SP//dr", "Peni",
"Sync Ratio", "Interface", "M.O.R.B.I.U.S." and every other card name in the pack — the transcript carries no
SP//dr-specific ruling beyond the Aug 3, 2026 surge/incite entry already cited below).

**Every card's own script already carries a docblock that ties its reading line-by-line to the printed text, cites
the exact RRG page or ruling for every non-obvious call, and names the precedent card whose shape it reuses** — the
same standard `docs/phase7-wave5-qa-ironheart.md` found for Ironheart. Spot-checked directly against the card scans
(not just the ingested `text.printed`/`text.current` fields) for the pack's trickiest cards: M.O.R.B.I.U.S. (31027,
carries an RRG 1.8 pp. 67–68 errata — scan shows the pre-errata "engaged hero"/"that hero", `text.printed` matches
the scan verbatim, `text.current` already carries the corrected "engaged player"/"that player's hero" with no
`curation/spdr.ts` fix needed), Thwip Thwip! (31017, exact "up to 2 enemies" divide shape), Giant Monster Attack
(31026, additional thwart cost), Web-Fluid Compressor (31013, the printed text's own "SP/dr" — one slash — data
transcription slip, not a different card) — all match. No wording drift found between any scan and its
`text.printed`.

Every ability id named in a card record's own `abilities` array is exercised by at least one test in the matching
`*.test.ts` file (all nine read: `identity.test.ts`, `events.test.ts`, `allies.test.ts`, `support-upgrades.test.ts`,
`obligation-nemesis.test.ts`, `sinister-syndicate.test.ts`, `cross-hero.test.ts`, `custom-deck.test.ts`,
`e2e.test.ts`), asserting the exact printed effect rather than "something happened".

Three things worth calling out precisely, none of them requiring a fix:

- **§4.1 Q24 (M.O.R.B.I.U.S. deals no damage while the engaged player is in alter-ego form) is scripted exactly as
  decided and tested both ways.** `obligation-nemesis.ts`'s `31027.morbius-forced-response` gates
  `dealDamage(eventAmount, identityOf(eventPlayer))` on `isHero(eventPlayer)`, and
  `obligation-nemesis.test.ts` proves both branches: hero form deals damage equal to the resources generated,
  alter-ego form generates the resource (confirming Q5's toon-counter carve-out doesn't apply to a plain hand-card
  payment) but deals none. The card's own errata (RRG 1.8 pp. 67–68, "engaged hero"/"that hero" →
  "engaged player"/"that player's hero") is present in `text.current` and confirmed against the scan (§1 above).
- **§4.1 Q37/Q38 (ready state follows the physical card; counters/attachments on SP//dr's other card move to the
  identity on a form change) are `coveredByEngineRule()` in `identity.ts`, not re-implemented, and are exercised at
  the card level, not just the engine level `separated-identity.test.ts` already covers generically.**
  `identity.test.ts` stages a counter on the INACTIVE Suit support and proves it lands on the identity after
  `toHero`, with the exhausted state carried over from whichever physical card the flip lands on (Maintenance's own
  cost exhausts the support pre-flip; the post-flip identity comes out exhausted). `e2e.test.ts`'s own scripted
  game additionally proves an *attachment* (not just a counter) makes the same trip in both directions across two
  separate flips (Round 1 hero, Round 2 back to alter-ego), and that counters/attachments already handed to the
  identity in an earlier flip are not handed back on a later one (a one-time transfer, not a per-form inventory).
- **§4.1 Q74 (cancelling a treachery's When Revealed cancels its surge and incite too — the later Aug 3, 2026
  ruling, not the RRG 1.8 FAQ "Spider-Man Noir (#15)" p. 63's older reading) is implemented generically
  (`cancelWhenRevealed`) and exercised by this pack's own Spider-Tingle (31020) ↔ Spider-Man Noir (31015)
  interaction** — the highest-value card-vs-card test in the pack, since it is exactly the FAQ entry's own worked
  example. `allies.test.ts`'s own test ("a treachery whose When Revealed was cancelled … did not resolve, so it
  can't be attached") stages Spider-Tingle cancelling "I'm Tough!" and confirms no `encounterCardResolved` event
  fires and Noir's own Response never triggers — the current-ruling reading, correctly *not* the older FAQ text's
  literal "if the treachery has a keyword ability… he can still trigger his response" carve-out. The conflict
  between the two sources is called out explicitly in both `allies.ts`'s own docblock and the spec (§4.1 Q74),
  rather than silently picked.

## 2. New tests added this pass

1. **`packages/cards/src/wave5/spdr/e2e.test.ts`, "Rhino (expert), solo: SP//dr"** — the wave definition of done's
   own "one expert game … to an outcome, replay deep-equal" requirement (this pack had a solo standard game, a
   hand-scripted standard game and a 2-player standard game, but no expert game, before this pass). Modeled
   directly on `../nova/e2e.test.ts`'s own "Rhino (expert), solo: Nova" (itself modeled on
   `wave4/hood/e2e.test.ts`'s "(expert)" test): `spdrScenario("rhino", { seed: SEED, difficulty: "expert" })`,
   played to a real outcome by the card-name-agnostic greedy driver, replayed and asserted deep-equal against the
   live session state. Confirmed passing directly against `WAVE5_DEPS` (4/4 tests in the file, including this one).
2. **`packages/cards/src/wave5/spdr/sinister-syndicate.test.ts`, "31031.boost: exhausts each identity it damaged
   (KNOWN_SKIPPED — dealIndirectDamage cannot bind its targets yet)"**, `it.fails`-pinned — see §3 below. Not a
   fix; a regression trap so a future engine fix shows up as a newly-passing test instead of silent drift.

## 3. Engine gap found (pinned, not fixed)

**Bombshell's Boost ability (31031, `sinister-syndicate.ts` `31031.boost`) only implements half its printed text.**
"[star] Boost: Deal 1 indirect damage to each player. Exhaust each character damaged this way." — the "Exhaust each
character damaged this way" clause was already flagged as `KNOWN_SKIPPED` in the script's own comment before this
pass (not a new finding), but carried no test pinning the gap, so nothing would catch a regression or announce a
fix. `dealIndirectDamage` has no bind for *which* character(s) it actually assigned damage to (unlike
`discardEncounterCards`'s `forEachDiscarded` or `chooseTarget`'s `chosen`; confirmed against `damageGroupFrame`'s
member event frames, which start with an empty `slots: {}` in `resolve/damage-group.ts`), so a follow-on effect in
the same ability has no way to read back "the character(s) damaged this way" the way every other multi-target "this
way" effect in this codebase does.

This pass adds an `it.fails` test (`sinister-syndicate.test.ts`) asserting the correct, currently-missing behavior
(both identities ready before the boost, both exhausted after it, in a 2-player game) — RRG 1.8 "Boost", p. 11:
every printed clause of a Boost card's own ability resolves, so the missing exhaust clause is a real gap, not a
reading choice. **Routed to `game-rules-architect`: `dealIndirectDamage` needs a bind for its assigned target(s)**,
the same shape `discardEncounterCards`'s `forEachDiscarded` already has. Gameplay impact is real but narrow: only
this one card in the current pool prints "X damaged this way" off an indirect-damage-to-each-player effect, so no
other pack's tests are affected.

## 4. What this pass did not do

- **Did not re-audit Nova, Ironheart, Ghost-Spider, Spider-Man (Miles Morales), or Spider-Ham** — out of this
  pass's stated scope (SP//dr pack only).
- **Did not touch `packages/cards/src/campaigns/` or `packages/engine/src/campaign*`** — another agent's own
  in-progress work in this worktree (visible in `git status` at the start of this pass); not this pack's scope
  either way.
- **Did not open a diagnostic/throwaway harness** — every claim and test in this pass ran directly against real
  `WAVE5_DEPS` (`pnpm --filter @mc/cards exec vitest run src/wave5/spdr` — 9 files, 132 tests, 131 passed + 1
  expected fail, before and after this pass's own two additions).

## 5. Findings routed elsewhere

1. **`game-rules-architect`: `dealIndirectDamage` needs a bind for the character(s) it actually dealt damage to**
   (§3 above) — pinned by `it.fails` in `packages/cards/src/wave5/spdr/sinister-syndicate.test.ts`, script gap
   documented in `packages/cards/src/wave5/spdr/sinister-syndicate.ts`'s own `31031.boost` comment.

No `ability-scripting-engineer`/`encounter-ai-designer` bugs found this pass, and no new rules question for the
user — Q24/Q37/Q38/Q74 are all built and tested exactly as decided (§1), and the one gap found (§3) is a plain
engine-primitive shortfall with no rules ambiguity attached.
