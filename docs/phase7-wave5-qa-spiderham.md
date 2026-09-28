# Phase 7 wave 5 rules-QA pass — Spider-Ham pack

`rules-qa-engineer` independent QA pass over the Spider-Ham pack only (docs/wave-definition-of-done.md §4), modeled
on `docs/phase7-wave5-qa-ironheart.md`. Scope: `packages/content/src/data/spiderham/cards.ts` (30001a/b–30038, 1
identity pair + 37 other cards, including the pack's own Inheritors modular set 30030–30038) and
`packages/cards/src/wave5/spiderham/*.ts` (identity, events, allies, support-upgrades, obligation-nemesis,
inheritors).

## 0. Starting state: already the strongest-documented pack audited this wave

Re-checked at the start of this pass: `pnpm --filter @mc/cards exec vitest run src/wave5` — 86 files, 944 tests, all
green before this pass's own addition; `pnpm --filter @mc/cards exec vitest run src/wave5/spiderham` — 9 files, 123
tests, all green (`e2e.test.ts` already existed, unlike some other packs at the start of their own passes). No
`wave4/reprints.ts` false-positive-alias blocker present here (`events.ts`/`support-upgrades.ts` alias reprinted
cards via direct object references into `JUSTICE`/`VENOM_KIT`/`NEBULA_PACK_CARDS`/`CAP_PACK_CARDS`/`ANT_PACK_CARDS`/
`GHOST_SPIDER_SUPPORT_UPGRADES_ALLIES`, never through the auto-scan module).

## 1. Card-by-card audit

All 39 Spider-Ham cards (30001a/b–30038) read against `packages/content/src/data/spiderham/cards.ts`'s printed
text, the card scans under `assets/card-art/bundles/cards/`, RRG 1.8, and
`marvel-champions-rulings-post-rrg-1-7.md` (grepped for "Spider-Ham", "Peter Porker", "toon counter", "Green
Gobbler", "Inheritor", "Gobbler Glider", "Feast on This", "Nefarious Trap", "Cartoon Physics", "Huge Wooden
Hammer", "Organic Webbing", "The Daily Beagle", "Overwatch", "Lady Spider", "Scarlet Spider", "SP//dr", "Captain
Americat", "Hunting the Spider").

**Every card's own script already carries a docblock that ties its reading line-by-line to the printed text, cites
the exact RRG page or ruling for every non-obvious call, and names the precedent card whose shape it reuses** — the
same standard the Nova/Ironheart passes found. Spot-checked directly against the card scans (not just the ingested
`text.printed`/`text.current` fields) for the pack's trickiest cards: Even the Odds (30014, the before/after
side-scheme-count subtraction for "damage the villain for each defeated this way"), "I Really Want a Hot Dog!"
(30024, the obligation's two-branch `chooseOne` with an independent toon-counter-and-ready-alter-ego gate), Huge
Wooden Hammer (30010, the player-attack `modifyStat`-not-`atkBonus` overkill shape), Overwatch (30019, the
threat-removal cap). All four match `text.printed`/`text.current` word for word; no wording drift found between any
scan and its ingested text.

Every ability id named in a card record's own `abilities` array is exercised by at least one test in the matching
`*.test.ts` file (confirmed by reading all nine: `identity.test.ts`, `events.test.ts`, `allies.test.ts`,
`support-upgrades.test.ts`, `obligation-nemesis.test.ts`, `inheritors.test.ts`, `cross-hero.test.ts`,
`custom-deck.test.ts`, `e2e.test.ts`), asserting the exact printed effect rather than "something happened."

Confirmed all six reprinted cards' aliases are byte-identical to their source pack's own `text.printed` (not just
"close enough" — a direct string comparison of both records' `printed` field):

- `30015` ("Great Responsibility") = `core` `01061` verbatim.
- `30016` ("Making an Entrance") = `vnm` `20013` verbatim.
- `30017` ("One Way or Another") = `nebu` `22015` verbatim.
- `30018` ("Followed") = `cap` `03032` verbatim.
- `30022` ("Team-Building Exercise") = `ant` `12024` verbatim.
- `30023` ("Web of Life and Destiny") = `sm` `27023` verbatim.

Three things worth calling out precisely, none of them bugs — this pack's own coverage had already closed the
highest-risk interaction points before this pass started:

- **Cartoon Physics' (30009) "prevent all but 1" floor is already exercised at both the normal and the
  interrupt-not-taken edges** — `support-upgrades.test.ts`'s own two tests ("discards the card and prevents all but
  1 of that damage" / "declining leaves the full damage to land") prove `preventDamage(scaled(eventAmount, { plus:
  -1 }))` reduces a real 2-damage Rhino attack to exactly 1, not to 0 and not to the full 2 — the shape a naive
  "prevent 1" (rather than "prevent all-but-1") misreading would fail differently on.
- **Huge Wooden Hammer's (30010) player-attack overkill spill is exercised through a real `basicAttack`, not
  asserted on the modifier alone** — `support-upgrades.test.ts`'s own "accepted…" test defeats a 1-HP-remaining
  minion with a 4-damage attack and asserts a genuine `overkillSpilled` event of amount 3 onto the villain, proving
  the docblock's own claim (a player's own attack reads `event.amount ?? profile.atk`, so `modifyStat` — not
  `modifyAttack.atkBonus` — is the only shape that actually lands the +2) against the real resolution pipeline, not
  just a unit check that the modifier value changed.
- **Overwatch's (30019) "an equal amount, capped at what's on the attached scheme" is exercised at the cap** —
  `support-upgrades.test.ts`'s own "moves only the threat actually removed: THW 2 against 1 threat…moves 1" proves
  `min(eventAmount, threatOn(host))` reads the *lower* of the two, not a bare `eventAmount` that could try to move
  more threat than the attached scheme ever had.

## 2. New test added this pass

`packages/cards/src/wave5/spiderham/e2e.test.ts`, **"Rhino (expert), solo: Spider-Ham"** — the wave definition of
done's own "one expert game… to an outcome, replay deep-equal" requirement (this pack had a solo standard game, a
hand-scripted standard game, and a 2-player standard game, but no expert game, before this pass — the one gap this
pass found in an otherwise complete test matrix). Modeled directly on `../ironheart/e2e.test.ts`'s own "Rhino
(expert), solo: Ironheart" (itself modeled on `../nova/e2e.test.ts`'s own "(expert)" test): `spiderHamScenario
("rhino", { seed: SEED, difficulty: "expert" })`, played to a real outcome by the card-name-agnostic greedy driver,
replayed and asserted deep-equal against the live session state. Confirmed passing directly against `WAVE5_DEPS`
(`pnpm --filter @mc/cards exec vitest run src/wave5/spiderham/e2e.test.ts` — 4 tests, all green).

## 3. Interaction coverage specifically checked (per this project's stated priority: card-vs-card over isolated-card)

All of the following were already covered before this pass; verified by reading the assertions, not just that the
`describe` block existed:

- **Lady Spider (30012) vs. a blocked thwart** (`allies.test.ts`/`cross-hero.test.ts`): a thwart that removes zero
  threat (Brute Force Barricade) never opens her "different scheme" choice — proves `valueAtLeast(eventAmount, 1)`
  actually gates on the *resolved* removal, not just on the thwart action having been taken.
- **Lady Spider vs. her own removal not retriggering herself**: her own `removeThreat` onto the different scheme is
  not itself a thwart, so it cannot reopen her own Response — implicit in the single-firing assertions, no bug
  found.
- **"I Really Want a Hot Dog!" (30024) with zero toon counters**: the exhaust option is unavailable and the reveal
  falls to the stun branch (`obligation-nemesis.test.ts`) — proves the `allOf(exists(ready alter-ego), hasToonCounter
  ())` gate is a real AND, not offered when only one half holds.
- **The Green Gobbler (30026) forced response in 2-player**: discards every counter type from every card the
  engaged player controls while a different player's own counters (also "toon") are untouched
  (`obligation-nemesis.test.ts`) — the highest-risk case for the new `removeAllCountersFrom` engine primitive (wrong
  scoping would either discard nothing or discard globally).
- **Inheritors set-wide grants stacking with two minions in play** (`inheritors.test.ts`, every one of the eight
  minions): each grant (acceleration icon, patrol, stalwart, guard, overkill+piercing, +1 ATK, villainous, retaliate
  1) is checked as present on *both* minions in play and absent from the real villain, not just present on the
  minion that prints it — proving the set-wide constant actually queries `INHERITOR_MINIONS` rather than only
  self-granting.
- **Solus's (30037) "villainous" grant changing another Inheritor's own activation boost-card count** — an actual
  behavioral consequence of the granted keyword (an extra boost card dealt to Bora's activation only when Solus is
  also in play), not just a `hasKeyword` check.
- **Hunting the Spider-Totems (30030) tie-break between "a player who controls a Web-Warrior character" and "the
  first player"**: tested with P1 (no Web-Warrior character) as first player and P2 (Spider-Ham, Web-Warrior) as the
  only qualifying player — proves the ability actually reads "if able" rather than defaulting to the first player
  regardless, and the companion "otherwise" test (no Web-Warrior character anywhere) proves the fallback path too.

## 4. What this pass did not do

- **Did not re-audit Nova, Ironheart, Ghost-Spider, Spider-Man (Miles Morales), or SP//dr's own separate hero pack**
  — out of this pass's stated scope (Spider-Ham pack only). ("SP//dr" the ally, 30021, inside Spider-Ham's own pack,
  is in scope and was audited above; the SP//dr hero pack itself is a different, later pack.)
- **Did not touch `wave4/reprints.ts`, `playable/`, or `campaigns/`** — outside this pass's assignment.
- **Did not open a diagnostic/throwaway harness** — no blocker was present; every claim and test in this pass ran
  directly against real `WAVE5_DEPS`.

## 5. Findings

No script bugs found. No engine bugs found. No content-data/provenance gaps found (unlike Ironheart's "Go for
Champions!" finding — every Spider-Ham card's `text.printed` matches its own scan verbatim, and no card in this
pack carries an RRG 1.8/post-1.7-ruling errata). No `it.fails`/rules questions for the user this pass.

The one real gap this pass found and closed was coverage, not correctness: the pack had no expert-mode end-to-end
game before this pass (§2). Every other interaction this pass specifically went looking for — the toon-counter
economy's AND-gates, the Green Gobbler's new multi-counter-type removal primitive, the Inheritors set's stacking
grants, Lady Spider's/Overwatch's threat-amount edge cases, Huge Wooden Hammer's player-attack overkill spill — was
already proven correct by tests written before this pass, to the project's own "assert the exact printed effect"
bar, not "something happened."
