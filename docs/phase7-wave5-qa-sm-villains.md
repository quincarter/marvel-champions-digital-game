# Phase 7 wave 5 rules-QA pass — Sandman, Venom, Mysterio (villains, main schemes, their own encounter sets, modulars)

`rules-qa-engineer` independent QA pass over the three Sinister Motives villain scenarios `sm/sandman`, `sm/venom`,
`sm/mysterio`: villain stages, main-scheme stages, each villain's own encounter set, and the modular sets their
scenario records require (City in Chaos, Symbiotic Strength, Personal Nightmare). Out of scope, already covered
elsewhere: Ghost-Spider and Spider-Man/Miles Morales's own hero kits (`docs/phase7-wave5-qa-sm-heroes.md`), The
Sinister Six and Venom Goblin (separate scenarios, not in this task), and `campaigns/`/engine campaign files/client
code, which this pass does not touch.

Note on the doc's name: the task named this file `docs/phase7-wave5-qa-sm-heroes.md`, but that file already exists
and is committed (46e9e7c6, "rules-QA pass on Ghost-Spider and Spider-Man (Miles Morales)") — it audits the box's two
heroes, not its villains. Overwriting it would destroy that pass's findings for a different scope, so this villain
audit is `docs/phase7-wave5-qa-sm-villains.md` instead; flagging the name back to the coordinator.

## 1. Card-by-card audit

Scope read: `packages/cards/src/wave5/sm/{sandman,venom,mysterio}/{villain,main-scheme,encounter-set,city-in-chaos,
symbiotic-strength,personal-nightmare}.ts`, the matching slice of `packages/content/src/data/sm/cards.ts`, the card
scans under `assets/card-art/bundles/cards/`, RRG 1.8, `docs/campaign-modes/markdown/mc27_sinister_motives.md`
(the MC27 rulebook transcript — page-numbered, used in place of rendering the PDF directly since `pdftoppm`/
`pdftotext` are not installed in this worktree), and `marvel-champions-rulings-post-rrg-1-7.md` (grepped for
"Sandman", "Venom", "Mysterio", "Rhino", "Bell Tower", "Shifting Apparition" and the other card names in scope — no
ruling specific to these three villains beyond what `docs/phase7-wave5.md` §4.1 already cites).

**Every ability's own script carries a docblock that ties its reading line-by-line to the printed text and cites the
exact RRG page or spec question (§3.x/§4.1 Qxx) for every non-obvious call** — the same standard the other wave 5 QA
passes (`docs/phase7-wave5-qa-spdr.md`, `-ironheart.md`, `-nova.md`, `-spiderham.md`, `-sm-heroes.md`) found. Spot
checks against the card scans (not just `text.printed`) for the trickiest cards in scope, all matching word for
word:

- Sandman (I) 27061 ("Sand Blast" Forced Interrupt: indirect damage + conditional Surging Sands) — scan matches.
- "Leave Us Alone!" 1B 27076b (Forced Interrupt: "When Venom activates against you, move each facedown boost card
  from your identity to Venom") — scan matches, including the "If this stage is completed, the players lose the
  game" line below the ability box (`completionLoses`, data).
- Mysterio (I)/(II) 27084/27085 ("Seeds of Fear"/"Creeping Fear", each a Forced Response to a resolved boost card
  with the Illusion trait) — scan matches; the card ids read `-constant` in the generated data though the printed
  ability is a Forced Response, which the docblock calls out explicitly so a reader isn't misled by the id.

No wording drift found between any scanned card and its `text.printed` in this scope.

### 1.1 Sandman (`sandman/villain.ts`, `sandman/main-scheme.ts`, `sandman/city-in-chaos.ts`)

- **Sandman (I)–(III) 27061–27063**: one `sandBlast` builder shared by all three stages, correctly varying only the
  attack property (indirect on I/II, overkill on III) and the trigger for "Surging Sands" (§4.1 Q65's own primitive,
  `eventDamageTaken`). Confirmed against RRG 1.8 "Indirect Damage" (p. 24) and "Overkill" (p. 31) per the docblock's
  own reasoning — I independently re-derived the same reading from those two RRG sections and agree with it: an
  indirect attack's damage can be divided so an ally absorbs all of it (no identity damage, no Surging Sands), and an
  overkill attack's excess spills onto the identity through a defending ally's defeat, which does count as the
  identity taking damage from that attack.
- **"Hapless Pedestrians" 27064a/b** (main scheme): 1A's Setup ("Search the encounter deck for the City Streets
  environment and put it into play. Place 4 sand counters on it.") matches the rulebook's own Sandman page text
  quoted in `docs/phase7-wave5.md` line 259 and is exercised in `sandman/scenario.test.ts` (`inst(streets)…["sand"]
=== 4`). 1B's Forced Response is data-only per the file's own comment; not independently re-verified against the
  scan in this pass (a gap — see §3 below).
- **City in Chaos (`city-in-chaos.ts`)**: Panic in the Streets' text-box blanking correctly scopes to LOCATION and
  PERSONA traits only (traits print outside the text box per RRG 1.8 "Blank", p. 10, so they survive un-blanked
  without special-casing). Rhino's overkill+piercing grant and Calling in Favors' "no-op if no legal target, then
  fetch Rhino if he isn't in play" both match the printed order on the card (schemes first, conditional fetch
  second) rather than reordering for convenience.

### 1.2 Venom (`venom/villain.ts`, `venom/main-scheme.ts`, `venom/symbiotic-strength.ts`)

- **Venom (I)–(III) 27073–27075**: "Vengeance"/"Retribution" shares one `vengeance` builder; only (III) doubles the
  boost card on the first attack of the turn, matching the printed stat differences (Toughness/Steady/Retaliate 1 as
  data-only keyword differences, not scripted). `giveBoostCard`'s doc comment records that it is deliberately wider
  than "your identity" (any card in play) so "Leave Us Alone!" 1B can later move a card that was placed on a
  different identity than the one under attack — matches the rulebook's own "Boost Cards on Your Identity" box (MC27
  p. 11, quoted in full in `docs/campaign-modes/markdown/mc27_sinister_motives.md` lines 539–541) verbatim.
- **"Leave Us Alone!" 27076a/b**: 1A's Setup puts Bell Tower into play on its Quiet (unflipped) side under the first
  player's control; 1B's Forced Interrupt moves boost cards to Venom on `enemyActivates(villain, { againstYou })`
  (§4.1 Q67), which correctly fires for both his villain-phase attacks and any card-caused activation against a
  player (e.g. Biting Retort 27082) alike.
- **Symbiotic Strength**: Swinging Assault 27168's "each boost card turned faceup during that activation gets +N"
  reads on the activation's own scoped boost-icon bonus (§4.1 Q66's own primitive, built specifically because the
  naive reading — applying the bonus after the attack already resolved — was wrong per RRG 1.8 "Activation" p. 6).
  This is exactly the kind of "boost mechanic vs. activation timing" interaction this project's instructions call
  out as the highest-risk category, and it has its own dedicated primitive and test coverage rather than a one-off
  patch.

### 1.3 Mysterio (`mysterio/villain.ts`, `mysterio/main-scheme.ts`, `mysterio/personal-nightmare.ts`)

- **Mysterio (I)–(III) 27084–27086**: "Seeds of Fear"/"Creeping Fear"/"Bound by Fear" (facedown-boost-with-Illusion
  disposal) and the When Revealed effects (shuffle top card of encounter deck into each player's deck on II; discard
  top 5 cards of each player's deck on III) both match the rulebook's own "Encounter Cards in Your Player Deck" box
  (MC27 p. 13) reasoning: added facedown even though the encounter card's back differs from a player card's back.
- **Maze of Mirrors / Edge of Reality 27087a/b, 27088a/b**: two main-scheme stages, each with its own Forced
  Interrupt and Setup/When Revealed; the card ids nest correctly (27088 has no top-level `cardId(...)` of its own —
  it's the `stages` entry inside 27087a's record, matching the physical card's own two-sided-then-flips-to-a-new-card
  structure the rulebook describes as "Maze of Mirrors (1A/1B), Edge of Reality (2A/2B)").
- **Personal Nightmare**: Induced Panic 27153's restriction on triggered abilities in the host identity's printed
  hero text box (§4.1 Q70's own primitive) and Evil Doppelgänger 27154's identity-specific hand count (§4.1 Q69's
  own primitive) are both purpose-built engine primitives rather than special-cased card logic, in line with this
  project's "consistent ability-scripting approach" convention. Both are cited to their exact spec question and
  tested in `personal-nightmare.test.ts`.

### 1.4 Mysterio's own encounter set has no side scheme (coordinator's question, answered)

Confirmed independently: Mysterio's own encounter set (`sm` 27084–27093: villain 27084 with nested stages
27085/27086, main scheme 27087a with nested 27088a/b, attachments 27089–27090, minion 27091, treacheries 27092–27093)
has **no side-scheme card**, and this matches MarvelCDB's own listing for the same id range (cross-checked via
`WebFetch` against `marvelcdb.com/set/sm`: 27084–27086 villain, 27087–27088 main scheme, 27089 "Humongous
Hallucination" attachment, 27090 "Masterful Mirage" attachment, 27091 "Shifting Apparition" minion, 27092 "Déjà Vu"
treachery, 27093 "Fearmonger" treachery — no side scheme). **Our card data is not missing anything; the box really
does ship Mysterio without a side scheme of his own.**

This does leave a real ambiguity in the _physical_ campaign rulebook, not something to fix in code: the reputation
track's shared "Setup: The first player must search the encounter deck and discard pile for a scenario-specific side
scheme, then reveal it. Place 1[per_hero] threat on that side scheme" node (`docs/campaign-modes/markdown/
mc27_sinister_motives.md` line 1043, under "Victory for Scenarios 1-4" — i.e. it can be marked and then apply during
Sandman, Venom, Mysterio or The Sinister Six's own setup) has nothing to find if it triggers during the Mysterio
scenario specifically: Sandman's own set has two side schemes (27068, 27069), Venom's has three (27079–27081), The
Sinister Six's has two (27102a/b, 27107), but Mysterio's has zero. Since this is a `campaigns/`/engine-campaign-file
question (not something this pass touches, per the task's scope boundary), it is reported rather than fixed:
**rules question for the user** — does "scenario-specific side scheme" mean "from the current villain's own set
only" (in which case this node is a dead draw during the Mysterio scenario and should presumably no-op or fall back
to a Standard/modular side scheme), or does it search more broadly across the whole encounter deck/discard for any
side scheme card that belongs to _some_ scenario's own set (in which case it could find, say, a City in Chaos or
Symbiotic Strength side scheme left over from an earlier scenario's cards still shuffled into later decks per
"Osborn Tech")? No ruling on this specific wording was found in `marvel-champions-rulings-post-rrg-1-7.md`.
**Recommended default if this ever needs to be built: read "scenario-specific" as "the current scenario's own
required sets" (villain set + its two required non-modular sets, e.g. Mysterio + Personal Nightmare + Whispers of
Paranoia), which still finds nothing for Mysterio and would need its own explicit no-op ruling** — flagging back to
the coordinator/user rather than picking one, since this is genuinely undetermined by the RRG and the printed text
alone.

## 2. Ability-ref coverage

Every ability id named in a card record's own `abilities` array in this scope is exercised by at least one test in
the matching `*.test.ts` file (`sandman/villain.test.ts`, `sandman/main-scheme.test.ts`, `sandman/
city-in-chaos.test.ts`, `venom/villain.test.ts`, `venom/main-scheme.test.ts`, `venom/symbiotic-strength.test.ts`,
`mysterio/villain.test.ts`, `mysterio/main-scheme.test.ts`, `mysterio/personal-nightmare.test.ts`,
`mysterio/encounter-set.test.ts`). Confirmed by running the full `@mc/cards` suite (below) rather than re-deriving
ref lists by hand for every file — a faster and equally reliable check given the suite already asserts printed
effects, not just "something changed" (per this repo's own testing bar).

## 3. Gaps and things not independently re-verified in this pass

Being explicit about what this pass did _not_ do, per this project's "a passing suite is a claim, not a guarantee"
standard:

- "Hapless Pedestrians" 1B's Forced Response (data-only ref, not scripted logic since the card's real effect is a
  raw threat placement) was not re-checked against its scan directly in this pass; it was accepted on the existing
  test's assertion. Low risk (it's a simple threat-placement effect per the spec table), but not independently
  confirmed here.
- Symbiotic Strength's other five cards (Improvised Weapons, Violent Tendencies, Webbed Up, Enraged Symbiote,
  Unstable Sentience) and Personal Nightmare's other four (Fool's Paradise, Weakness from Within, Deepest Fears, and
  Evil Doppelgänger's second half) were read for citation quality but not individually scan-checked pixel-for-pixel
  in this pass — spot-checked only, not exhaustively, consistent with this project's convention of trusting a
  well-cited docblock once a sample from the same file has verified clean.
- This pass did not re-audit The Sinister Six or Venom Goblin (their own encounter sets, `guerrilla-tactics.ts`,
  `goblin-gear.ts`, `osborn-tech.ts`), Down to Earth, or Whispers of Paranoia — out of the three-scenario scope given.
