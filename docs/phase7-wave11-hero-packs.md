# Phase 7 working spec: wave 11, the hero-pack pass (Jessica Jones and Luke Cage)

The hero-pack pass of the wave 11 spec, kept apart from the box pass, [phase7-wave11.md](phase7-wave11.md) (Fear No
Evil). Sections carry an `H` prefix (H0 sources, H1 data, H2 the heroes, H3 engine primitives, H4 open questions, H5
notes, H7 coverage, H8 build order) and open questions are numbered from 101, so nothing collides with the box pass.
Model: [phase7-wave10-hero-packs.md](phase7-wave10-hero-packs.md). Wave 1–10 primitives are assumed.

**Scope: every card of the two packs. Neither has a modular set.**

- **Jessica Jones** (`jj`, 61001a/b–61040): kit 61002–61014, obligation Work-Life Balance 61030, nemesis set
  61031–61033c (Purple Man, Indomitable Will, three Suggestion obligations), aspect and basic cards.
- **Luke Cage** (`luke_cage`, 62001a/b–62037): kit 62002–62011, obligation Internal Injury 62028, nemesis set
  62029–62033 (Cottonmouth, Venomous Whispers, Augmented Jaws, Asp, Sidewinder), aspect and basic cards.

Agents do not edit statuses or open questions; they report, and the main session flips them.

**The short version.** No new card type; one new attachment host. Of the 24 primitives in H3, **4 are new**
(unpreventable damage, skipping a villain phase, Starting, Prerequisite), **11 extend** something that exists and **9
are reusable**. H8.2 queues 15 engine tasks and H8.4 17 scripting modules. Three questions are open (Q101–Q103).

---

## H0. Sources read

- **Card text:** `raw/marvelcdb/jj.json` (42 records, 43 faces) and `luke_cage.json` (37, 38), dumped by script. No scan
  was opened: every printed-card claim is unchecked except the identity faces the survey checked (61001a/b, 62001a/b).
- **RRG 1.8** (pages from the markdown's footers) and **FFG rulings** (searched by every title and by tough,
  unpreventable, player side scheme, uniqueness); each is cited where it is used. Appendices IV and V name no card of
  these packs: no errata. **Inserts:** MC61/MC62 as text-extracted by the survey (§5); the Fear No Evil transcription,
  p. 3, for Starting and Prerequisite. **Engine and DSL** searched by name; each H3 status names what was found.
- **Corrections to the sources page and the survey.** (1) Echo ally 61038's subtitle "Maya Lopez" is Echo's alter-ego
  title, so it **does** match the Echo identity (sources §4 says not). (2) Stakeout 61014 is not Permanent (survey §5).
  (3) Core's Jessica Jones 01059 and Luke Cage 01076 allies also match the two identities.

---

## H1. Schema and data needs

**Curations.** `curation/jj.ts` and `curation/luke_cage.ts` with the box's cycle object (`cycle11`; its display name is
the box pass's question), release 2026-08-21 (MarvelCDB `available`, a pointer; FFG says "August, 2026"), `outDir`
`src/data/jj` and `src/data/luke_cage`, `exportPrefix` `JJ` and `LUKE_CAGE`, registered in `ingest-marvelcdb.ts` and
`survey.ts`. **Emit `jj` first**: 62024 reprints 61027. Listing order: Jessica Jones first.

**Corrections owed.**

| Card                       | Raw                                                    | Decision                                                                                                            |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 61002 Alias Investigations | no `cost`                                              | `cardNotes`: dash cost (Permanent; 61001b's Setup puts it into play), as Ionic Physiology 58002                     |
| 61031 Purple Man           | no `attack`, no `scheme`                               | 0 with a "star stat" `cardNotes`, **not** `dashedMinionStats`: a dash cannot be modified (RRG p. 15); H3.10 stacks  |
| 61033a/b/c Suggestion      | names "Suggestion ([energy])" and so on                | `Correction.name` "Suggestion" on all three: 61032 reads "each Suggestion obligation" by title (unchecked, no scan) |
| 62020 Hulk                 | no `thwart`                                            | `cardNotes`: dash THW                                                                                               |
| 61040 Mitigated Threat     | "Attach to a card." unrecognized                       | `AttachmentHost { kind: "anyCard" }` after HT6                                                                      |
| 62010 Metal Bracer         | "Metal Bracer"; the rulings page says "Metal Bracelet" | keep the raw name (H3.23)                                                                                           |

**What the records carry.** Permanent 61002. Toughness 61003, 62013, 62014, 62021. Restricted 61023. Alliance 61026.
Team-Up 61027/62024 (Jessica Jones and Luke Cage), 62023 (Iron Fist and Luke Cage). Starting 61034, 61036, 61037.
Prerequisite (Defender) 61029. Hinder 1 per player 61029 (a player side scheme), Hinder 3 per player 61032. Victory 0
61020, 61021, 61028, 61029, 61039. Uses: 3 pheromone (61033a–c), 3 block (62018). Quickstrike 62033. Max 1 per deck
61022, 61027, 62016, 62023, 62024, 62025–62027; Max 2 per deck 62017; Max 1 per player and "play under any player's
control" 61035, 62019 (and Max 1 per player 61024); Max 1 per minion 62009; Max 1 per character 62037. Hosts: a minion
62009, a friendly character 62037, Cottonmouth otherwise the villain 62031, any card 61040. Counter types (free text):
`evidence`, `limb`, `squirrel`, `pheromone`, `block`, `rage`. Reprints (verbatim, survey §7): 61018, 61021, 61022, 62016,
62017, 62024, 62025–62027.

**Starter decks.** No printed list is available (survey §10): both precons are the survey's MarvelCDB stand-ins,
`verified: false` (Jessica Jones / Justice, 40 plus Alias Investigations; Luke Cage / Leadership, 40).

---

## H2. The two heroes in plain words

**Jessica Jones builds a case, then closes it.** Each basic power in hero form puts an evidence counter on Alias
Investigations (Permanent, put into play by her alter-ego's Setup). Kit cards add evidence or spend it; after a side
scheme is defeated she may spend evidence equal to the villain's remaining hit points to defeat its current stage.
Purple Man copies the best stats at the table; Suggestions force plays of one resource icon. **Luke Cage stacks tough
and takes the hits.** He holds any number of tough cards and attacks against him lose piercing, but each tough card
discarded deals him 1 unpreventable damage; his kit gives tough, scales with it and pays him back as it goes. His
nemesis set strips tough and attacks three times; Internal Injury deals 3 unpreventable damage a round until he
recovers.

---

## H3. Engine primitives (owner: `game-rules-architect`)

**New**, **extend** (something exists and needs a change) or **reusable** ("verify": read, the exact use untested;
"compose": the DSL already says it). Every identifier was searched for by name this session.

| §     | Primitive                                                          | Status             |
| ----- | ------------------------------------------------------------------ | ------------------ |
| H3.1  | Uniqueness across the two packs; the Team-Up stand-in              | reusable (verify)  |
| H3.2  | Luke Cage's tough rules                                            | reusable (compose) |
| H3.3  | Unpreventable damage                                               | new                |
| H3.4  | Evidence counters on a named card                                  | reusable (compose) |
| H3.5  | A counter cost whose amount is read from the board                 | extend             |
| H3.6  | Defeating the villain's current stage by an effect                 | reusable (verify)  |
| H3.7  | Skipping the next villain phase                                    | new                |
| H3.8  | "Until the start of the next (unskipped) villain phase" in the DSL | extend             |
| H3.9  | "Until the end of the player phase" begun outside it               | extend             |
| H3.10 | A stat equal to the highest among the other characters in play     | extend             |
| H3.11 | "Attach to a card."                                                | extend             |
| H3.12 | An interrupt to a thwart that reads whether that thwart defeated   | extend             |
| H3.13 | An in-play upgrade attaching itself from its play area             | reusable (verify)  |
| H3.14 | A basic thwart made by an effect, without exhausting               | extend             |
| H3.15 | Attacks against a character gain a keyword and deal extra damage   | extend             |
| H3.16 | "Play it as if it were in your hand" from a deck search            | extend             |
| H3.17 | Starting                                                           | new                |
| H3.18 | Prerequisite (form or trait)                                       | new                |
| H3.19 | Exactly defeat (characters)                                        | reusable (compose) |
| H3.20 | An ally named by a found Team-Up card                              | extend             |
| H3.21 | "Has a Boost ability" as a query                                   | extend             |
| H3.22 | A player side scheme outside the limit (61007)                     | reusable           |
| H3.23 | Rulings on behavior the engine already covers                      | reusable (verify)  |
| H3.24 | Everything else                                                    | reusable           |

### H3.1 Uniqueness across the two packs; the Team-Up stand-in

**Status: reusable (verify).** `cardsMatch`, `isUnique` (`engine/src/unique.ts`, RRG pp. 45–46 transcribed); the Team-Up
replacement in `validateDeck` (`deck.ts`, "Appendix I's Team-Up replacement").

**Settled by RRG 1.8 (the sources page's question).** Each identity's alter-ego title is its own name (61001b "Jessica
Jones", 62001b "Luke Cage"). RRG p. 45: "The subtitle or alter-ego title of one matches the title, subtitle, or
alter-ego title of the other." So **61003 Luke Cage (ally) matches the Luke Cage identity and 62002 Jessica Jones
(ally) matches the Jessica Jones identity**; the identities do not match each other. With both heroes seated, p. 50
lets a player "replace the matching card … with a card with the Team-Up keyword that names both": Unbreakable Bond
61027/62024 is the designed stand-in. In play (p. 46) a matching ally "cannot be played or put into play".

**Other matches (tests, not code).** Echo 61038 and the Echo identity; Valkyrie 62014 (Brunnhilde) and the Valkyrie
identity (the January 26 and March 19, 2026 rulings are about the subtitle-less `thor` ally 06012, which does not
match); Hulk 62020, She-Hulk 62021 and Captain Marvel 61015 with their identities and earlier allies; Squirrel Girl
61017 and the `cap` ally 03013; Hellcat 61025 and Core 01020; Iron Fist 62012 and `drs` 09014; Core 01059 and 01076 against the identities and 62002/61003. **No match:**
Spider-Woman 61016 (Mattie Franklin) against the Spider-Woman identity and the Jessica Drew allies.

**Tests.** Both heroes seated: each deck legal with its ally replaced by Unbreakable Bond; 61003 not offered; Unbreakable
Bond playable (both identities are friendly characters). An Echo deck listing 61038 is refused.

### H3.2 Luke Cage's tough rules

**Status: reusable (compose).** `anyNumberOfToughStatusCards` (`dsl/abilities.ts`; engine `statusLimit`, Armadillo, wave
5 §3.19), `attacksLoseKeywords(["piercing"], { target })` (Cap's Shield, wave 10 §3.18), `on.statusDiscarded`. RRG
"Status Cards" (p. 41) allows one of each type; the card text wins (p. 4). "Tough" (p. 44): one tough card is discarded
per damage instance. Several discarded at once (Augmented Jaws) are several conditions of one occurrence: the Forced
Response resolves once per card and Power Man (exhausts) answers one (`announceStatusDiscarded`, wave 6 §4.1 Q5).
**Test:** four tough cards, Augmented Jaws attack: four discarded, four times 1 unpreventable damage, Power Man draws
once, then the attack. A piercing minion against Luke Cage discards nothing; against Misty Knight it does.

### H3.3 Unpreventable damage

**Status: new.** `dealDamage.ignoreTough` (`spec.ts`; Lightning Strike, errata p. 65) takes damage through a tough card
and leaves it; no `unpreventable` exists in the engine or the DSL. Cards: 62001a ("1 unpreventable damage (ignoring
tough)"), 62028 ("3 unpreventable damage (ignoring tough status cards)"). RRG 1.8 has no entry; the MC62 insert: "cannot
be reduced or prevented", tough not removed. The June 25 and July 9, 2026 rulings treat "reduce" and "prevent" alike.
**Engine reading, sourced to the insert.** Build `unpreventable: true` on `dealDamage` and `takeDamage`: implies
`ignoreTough`; no `reduceDamageTaken`, `preventAllDamage`, `maxDamageTakenPerAttack` or `maxSustainedDamage` rule
applies; no interrupt that reduces or prevents it is offered (Metal Bracer, Reluctant Flier); increases apply; logged as
unpreventable. Redirects: Q103. **Test:** 2 tough, Metal Bracer ready, Internal Injury: 10 to 7, 2 tough left, Bracer
not offered; at 3, defeated.

### H3.4 Evidence counters on a named card

**Status: reusable (compose).** `addCounters` on `named("Alias Investigations")` you control, `removeCountersFrom`,
`removeCounter(…, { from })`, `on.countersPlaced` (one placement per event, `eventAmount`). Breakthrough 61005 answers
each placement once. With Alias Investigations out of play (owner eliminated) placements do nothing and spending costs
cannot be paid. "Big Mistake" 61004: an optional removal inside the effect, then `modifyAttack({ extraDamage: 2 })` and
the chosen overkill or piercing.

### H3.5 A counter cost whose amount is read from the board

**Status: extend.** `AbilityCost.spendCounters.amount` and `removeCounter(type, n)` take a number only. 4K Digital
Camcorder 61009: "choose a non-[Elite] minion. Remove X evidence counters …, where X is equal to 2 less than that
minion's remaining hit points → discard that minion." Build a `ValueSpec` amount read when the cost is determined, able
to read the target chosen with the cost (RRG "Initiating Abilities", p. 24); below 0 is 0; not repeatable. **Test:** a
5-hit-point minion and 3 counters: 3 paid, minion discarded (no Victory, no When Defeated); at 6: not offered.

### H3.6 Defeating the villain's current stage by an effect

**Status: reusable (verify).** `defeat({ kind: "villain" })` (`defeat-effect.test.ts`; RRG "Villain Defeat", p. 47).
Alias Investigations: "Then, you may remove evidence counters from here equal to the villain's remaining hit points to
defeat the villain's current stage." Offered only with enough counters; the last stage wins the game. **Test:** stage I
at 7 hit points, 7 counters: stage II revealed, 0 counters left.

### H3.7 Skipping the next villain phase

**Status: new.** Nothing skips a phase (grep `skip`: one doc comment). Run Them to Ground 61020, When Defeated: "Skip
the next villain phase. / Deal each player 1 facedown encounter card (immediately). / The villain cannot take damage
until the start of the next (unskipped) villain phase." RRG 1.8 has no "skip" entry; "Villain Phase" (p. 47) ends with
step 5 (pass the first player token) and step 6 (end the phase and the round). "Deal" (p. 15): a dealt card "is not
revealed at this time" and waits for the villain phase, so these wait for the next one played. Q101 settles which steps
a skip removes. **Build:** an effect `skipNextVillainPhase` adding 1 to `GameState.villainPhasesToSkip`; when the
villain phase would begin with the count above 0, decrement, log `villainPhaseSkipped`, raise no villain-phase begin or
end event, and (Q101 A) end the round (round durations end, "at the end of the round" and temporary resolve, the token
stays). **Test:** two players: no threat, no activation, the first player unchanged, one facedown card each revealed in
the following villain phase, a Temporary card discarded.

### H3.8 "Until the start of the next (unskipped) villain phase" in the DSL

**Status: extend.** Engine `LastingUntil "nextVillainPhaseBegins"` (wave 8 §3.13) is accepted by `applyRuleUntil` in
`apply-effect.ts`; the DSL's `applyRuleUntil` type omits it. Widen the DSL union; `cannotTakeDamage` on the villain
through it. A skipped phase never begins (H3.7). **Test:** no damage to the villain through the skipped phase and the
next player phase; damage again from the next phase played.

### H3.9 "Until the end of the player phase" begun outside it

**Status: extend.** `LastingUntil` has `endOfPhase` (the current phase) and no player-phase duration. Take a Stand 62015
lasts "until the end of the player phase" after a defense, mostly in the villain phase. RRG "Lasting Effects" (p. 26):
it expires "as soon as the timing point specified by its duration is reached"; "Player Phase" (p. 34) names "until the
end of the [player] phase" as that point. So: the end of the current or the next player phase. Build `endOfPlayerPhase`.
**Test:** defended in the villain phase, the bonus lasts through the next player phase.

### H3.10 A stat equal to the highest among the other characters in play

**Status: extend.** `superlative` (`dsl/values.ts`) and `setBase` modifiers (`baseStatsFromYourHero`, wave 7 §3.25)
exist; `modifiersFor` (`modifiers.ts`) has no guard against a stat that reads itself. Purple Man 61031: SCH "equal to
the highest SCH or THW among characters in play", ATK "the highest ATK". Build `highestStatAmong(stats, among)` over
characters in play **other than the reading card**, each measured by the larger of its listed stats, as a `setBase` so
other modifiers stack. Excluding himself is an engine interpretation (including him is circular). Alter-egos add
nothing. **Test:** hero THW 3, villain SCH 2: SCH 3; +1 SCH attachment: 4; the hero changes to alter-ego: 2.

### H3.11 "Attach to a card."

**Status: extend.** `AttachmentHost` (`content/src/schema/cards/attachment-host.ts`) has no any-card kind; the parser
reports "unrecognized attach rule" for 61040.

**Settled by RRG 1.8 (the sources page's question).** "Attach To" (p. 8): attached "to … the specified game element as
it enters play"; "a card" names no type, controller or icon. So the host is **any card in play other than Mitigated
Threat itself**: player or encounter card, villain, main or side scheme, identity, environment. A card out of play (a
facedown dealt card) is no host. Control follows "Upgrade" (p. 46). Build `{ kind: "anyCard" }` in the schema, the
parser and `attachment-hosts.ts`. The constant is `losesIcon` on `hostOfSelf` for the four icons.

### H3.12 An interrupt to a thwart that reads whether that thwart defeated

**Status: extend.** `modifyThwart({ extraThreat })` and `atEndOfAttack` exist; no thwart sibling. Stakeout 61014: "When
a character thwarts attached scheme, that thwart removes 2 additional threat. If that thwart defeats attached scheme,
place 2 evidence counters." The defeat discards Stakeout with its host, so the interrupt sets the check up. Build
`atEndOfThwart(...effects)` with the thwart's results bound. **Test:** scheme at 3, thwart 1 + 2: defeated, 2 evidence,
Stakeout discarded; scheme at 5: none placed.

### H3.13 An in-play upgrade attaching itself from its play area

**Status: reusable (verify).** `attachCard(self, host)`; in-play rehosting (`wave10-permanent-attachment-rehost`).
Stakeout's Action ("If this card is in your play area, attach it to a non-permanent encounter side scheme"): condition
`inPlayAreaOf(you)` and not attached; the host query excludes player side schemes and permanent ones.

### H3.14 A basic thwart made by an effect, without exhausting

**Status: extend.** `basicPowerBy` (`spec.ts`, wave 8 §3.64) exhausts, needs a ready character, takes `bonus`. Grapnel
Launcher 61023: "make a basic thwart without exhausting (even if you are exhausted) … +1 THW and ignores the patrol
keyword and any crisis icons in play." Add `character` (your hero), `withoutExhausting` (allowed while exhausted; a
confused hero still loses the card, RRG p. 13) and `ignores` for that use. **Test:** exhausted, THW 2, crisis on the
main scheme: 3 removed from it, still exhausted.

### H3.15 Attacks against a character gain a keyword and deal extra damage

**Status: extend.** `attackKeywords` is scoped by `attacker` / `via` only; `modifyAttack.extraDamage` is for one attack
in progress. Cruisin' for a Bruisin' 62009: "Attacks against attached minion deal 2 additional damage and gain
overkill." Add a `target` (the attacked character) to `attackKeywords`, mirroring `attacksLoseKeywords.target`, and a
constant extra damage for attacks against a matching character, added as `extraDamage` is. **Test:** basic attack 2 on a
3-hit-point minion: 4 dealt, 1 spills to the villain.

### H3.16 "Play it as if it were in your hand" from a deck search

**Status: extend.** `playFromDeckReducingCost` plays from the deck; only `playableTopOfDeck` logs `countsAsFrom: "hand"`
(`events.ts`, FAQ p. 64). Calling in Favors 61008: "play it as if it were in your hand, reducing its resource cost by
2". Add `asIfInHand`, logged `countsAsFrom: "hand"`, so "after you play X from your hand" (Squirrel Girl 61017) answers.
By analogy with RRG 1.8 FAQ "Magik (#30A)" (p. 64) only: Q102.

### H3.17 Starting

**Status: new, shared with the box pass (Innate Reflexes 60038).** Schema keyword `starting`; no engine reading. 61034,
61036, 61037. Fear No Evil rulebook p. 3: "Each deck cannot include more than one card with starting. Before drawing
their starting hand …, each player with a starting card in their deck may search their deck for that card and add it as
the first card of their starting hand. That card does count against their hand size and can be discarded for the
mulligan." RRG 1.8 has no entry; it lands before setup step 14 (p. 51). Build once: `validateDeck` refuses a second
Starting card; a setup choice, then a draw of hand size minus one. Whichever pass reaches it first owns it.

### H3.18 Prerequisite (form or trait)

**Status: new.** Schema keyword `prerequisite` (`traits` / `form`); no engine reading. Defend Our City 61029,
"Prerequisite ([Defender])". Fear No Evil p. 3: "In order for a player to play a card with prerequisite …, their
identity must be in the specified form … or have the specified trait." A play restriction; put into play bypasses it
(RRG p. 32). Build it into `canPlay`. **Test:** a Defender plays it, a non-Defender cannot.

### H3.19 Exactly defeat (characters)

**Status: reusable (compose).** `attackExcessAsDealt` (`dsl/values.ts`). Shakedown 61035. August 3, 2026 – Ruling 6:
defeated "by an attack that dealt **no excess damage**"; reducers "generally cannot be exactly defeated". So read the
excess **dealt** (`excessAsDealt` = 0), not taken. The box pass needs the same (Know Your Enemy, Stick); one shared
named value.

### H3.20 An ally named by a found Team-Up card

**Status: extend.** `teamUpCharacters` and `ofTeamUpSet` read friendly characters or an identity set, not out-of-play
allies by name. Dynamic Duo 62022: "Search your deck and discard pile for a Team-Up card and an ally named by that
card's Team-Up keyword." Build `namedByTeamUpOf(ref)` (title or subtitle, RRG p. 43) for a deck and discard search after
the Team-Up card is bound. **Test:** Power Man and Iron Fist found, then Iron Fist 62012.

### H3.21 "Has a Boost ability" as a query

**Status: extend.** `printsAbility` takes action and response only; `hasBoostAbility` is private to `defend-preview.ts`.
Sidewinder 62033: "If the discarded card has a 'Boost' ability, deal Sidewinder to the attacking player as a facedown
encounter card." Make the query public. Dealt from play mid-attack (`dealAsEncounterCard`, wave 8 §3.75), the attack has
no target and deals nothing: test that.

### H3.22 A player side scheme outside the limit (61007)

**Status: reusable.** `excludedFromPlayerSideSchemeLimit` (`dsl/abilities.ts`; `resolve/enter-play.ts`
`playerSideSchemesCounted`; wave 7 §3.2).

**Settled (the sources page's question).** Card text over the RRG (p. 4); RRG p. 34 counts the others. A per-card
constant, not a data flag: it is left out of the count, so playing it at the limit discards nothing and it is never
among the schemes discarded for the limit. **Test:** two players, Lay Low in play, Piecing It All Together played: both
stay.

### H3.23 Rulings on behavior the engine already covers

**Status: reusable (verify).** One ruling test each (`rules-qa-engineer`).

- **June 25, 2026 – Ruling 6; July 9, 2026 – Ruling 2** ("Metal Bracelet" with Clarity of Purpose, `spdr`): damage taken
  as a cost may be reduced to 0 and stays paid. **Name settled:** the card the rulings mean is 62010 by its text (Luke
  Cage, reduce by 1); a name is printed data, not a rule, and raw and every decklist say "Metal Bracer". Keep it and
  quote the ruling's wording in the test.
- **August 3, 2026 – Ruling 2.** (1) Echo 61038 reduces indirect damage from an enemy attack; "up to her remaining HP"
  is RRG p. 24's assignment cap ("without accounting for interactions with other abilities"). (2) Valkyrie 62014's
  would-be-defeated interrupt resolves before simultaneous ally defeats (wave 9 §3.5).
- **January 17, 2026 – Ruling 3 (2):** piercing before "would take damage" interrupts; moot for Luke Cage, not his allies.
- **July 9, 2026 – Ruling 3 (3)** is about the Core Hellcat 01020's bounce, not 61025. No bearing.

### H3.24 Everything else (checked by name)

Each card's vocabulary is named in its H7 row. The builders it rests on, all found in `packages/cards/src/dsl`: `setup`,
`forcedAction`, `formChangeCost`, `applyRuleUntil(cannotChangeForm, …)`, `chooseOne` with option costs,
`playFromHandReducingCost`, `discardEncounterCards`, `revealCard`, `discardEncounterUntil`, `addCounters` (`upTo`),
`handCountOf`, `printedResourcesOf`, `identitySetOf`, `reduceCostOfCards`, `gainsAbility`, `putIntoPlay`, `atEndOfPhase`,
`atEndOfRound`, `teamUpCharacters`, `divide`, `eventResult("threatPlaced")`, `reduceDamageTaken`, `preventDamage`,
`losesIcon`, `giveTough`, `statusCount`, `repeatTimes`, `costModifier`, `discardStatusCost`, `returnToHandAfterResolving`,
`gainsKeywordX`, `oncePerPhase`, `enemyAttack`, `dealAsEncounterCard`, `cannotAttack`, `stun`, `setRemainingHitPoints`,
`remainingHpCompare`, `enemyScheme`, `playOnlyIf`, `gainsTrait`, and the `on.*` patterns `basicPowerUsed`,
`schemeDefeated`, `defeated`, `defends`, `enemyActivates`, `enemySchemes`, `villainAttacks`, `entersPlay`,
`phaseEnding`, `basicRecovery`. Rules they lean on: an ability's form change is not the turn's (RRG p. 21); an
obligation's "you" is its holder (p. 30); encounter cards ready at the end of the player phase (p. 18 step 3), so a
Suggestion's forced action comes once a round.

---

## H4. Open questions for the owner

Numbered from 101. Until answered, **A is what gets built**; the main session records answers in the main spec's §4.1
table and the PR.

| Q    | Question                                                                                                      | A (default)                                                        | B                                                  | Decision                  |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- | ------------------------- |
| Q101 | Run Them to Ground: what does skipping the villain phase leave?                                               | Villain-phase steps 1–5 skipped; the round still ends; token stays | As A, but the first player token passes            | **A** (owner, 2026-10-18) |
| Q102 | Calling in Favors: is an ally played from the deck "from hand"?                                               | Yes: Squirrel Girl's response answers                              | No                                                 | **A** (owner, 2026-10-18) |
| Q103 | Unpreventable damage and effects that redirect it                                                             | Only reductions, preventions and tough are barred; redirects work  | No "would take damage" effect may change it at all | **A** (owner, 2026-10-18) |
| Q104 | Take a Stand (62015) used in the villain phase vs RRG p. 26 ("can only be initiated during that time period") | The bonus lasts through the next player phase                      | Strict: nothing outside a player phase             | **B** (owner, 2026-10-18) |

**Q101** (61020, H3.7). RRG p. 47: step 5 "Pass First Player Token", step 6 "End of Villain Phase and Round"; the Round
Overview (p. 4) lists "Pass the first player token" (9) and "End the round" (10). No ruling. A: no threat, activations,
dealing, reveals, token pass or villain-phase triggers; the round's end still happens. B: the same, but the token
passes. Either way the cards dealt "immediately" wait for the next villain phase played (p. 15).

**Q102** (61008 with 61017, both in the Jessica Jones precon). FAQ "Magik (#30A)" (p. 64) says a card Magik plays from
her deck "is considered to have been played from her hand", for her ability. A: the same wording, the same answer. B:
it came from the deck, so "from your hand" does not answer.

**Q103** (62001a, 62028, H3.3). The insert says only "cannot be reduced or prevented". A: an effect that moves the damage
to another character, or an increase, still applies. B: nothing that answers "would take damage" may change it.

**Settled here, not asked:** the unique matches (H3.1, RRG pp. 45, 46, 50); Metal Bracer's name (H3.23); the "attach to a
card" host (H3.11, p. 8); the 61007 exemption (H3.22); exactly defeat (H3.19, August 3, 2026 – Ruling 6); Echo's
indirect damage (H3.23, p. 24); the player-phase duration (H3.9, pp. 26, 34); Purple Man not reading himself (H3.10,
engine interpretation, the alternative is circular).

---

## H5. Notes for the other agents

- **Deck building** (`deck.ts`). Alias Investigations is Permanent: required, not counted (RRG p. 50). One Starting card
  per deck. Add the Jessica Jones and Luke Cage and the Iron Fist and Luke Cage pairs to `docs/team-ups.md`; with both
  heroes at one table the builder offers the H3.1 stand-in and says why.
- **`ability-scripting-engineer`.** Keep the card's words apart: "discard" (Camcorder) and "defeat"; "play" and "put into
  play"; "your identity" (62002, She-Hulk) and "Luke Cage" (the kit); "Defender character" and "Defender ally".
- **`encounter-ai-designer`.** Cottonmouth's extra attacks go to the character the first attack ended against;
  Sidewinder deals himself to the attacking player. Nothing else new.
- **`rules-qa-engineer`.** H3.23's rulings; H3.1's matches and non-matches; Augmented Jaws on four tough cards; Internal
  Injury with Metal Bracer; Run Them to Ground across a skipped phase; Purple Man on a changing table; Q101–Q103 at their
  defaults, each test named for its question.
- **`game-client-engineer`.** Evidence and each spend's price; Luke Cage's tough count; unpreventable damage marked in
  the log; "villain phase skipped" and why the villain takes no damage; Purple Man's current stats and whose he copies;
  a Suggestion's icon, counters and owed forced action; Mitigated Threat's removed icons; the Team-Up stand-in at setup;
  Guided mode tips for evidence and stacking tough (`docs/wave-definition-of-done.md` §5).

---

## H7. Card coverage

Every face of both packs. "DSL" is vocabulary named in H3.24; a blocker is an H8.2 task or an open question.

### H7.1 Jessica Jones (`jj`)

| Id     | Title                   | Type / aspect             | Needs                                        | Blocker        |
| ------ | ----------------------- | ------------------------- | -------------------------------------------- | -------------- |
| 61001a | Jessica Jones           | hero                      | H3.4                                         | none           |
| 61002  | Alias Investigations    | support                   | H3.4, H3.6; data (dash cost)                 | none           |
| 61003  | Luke Cage               | ally                      | H3.1; DSL (toughness, give self tough)       | none           |
| 61004  | "Big Mistake"           | event                     | H3.4                                         | none           |
| 61005  | Breakthrough            | event                     | H3.4                                         | none           |
| 61007  | Piecing It All Together | player side scheme        | H3.22                                        | none           |
| 61008  | Calling in Favors       | support                   | H3.16                                        | HT11; Q102     |
| 61009  | 4K Digital Camcorder    | upgrade                   | H3.5                                         | HT8            |
| 61010  | Circumstantial Evidence | upgrade                   | H3.4                                         | none           |
| 61014  | Stakeout                | upgrade                   | H3.12, H3.13                                 | HT7            |
| 61031  | Purple Man              | minion (nemesis)          | H3.10; data (star stats)                     | HT5            |
| 61017  | Squirrel Girl           | ally, Justice             | DSL (from hand, counters to 4); H3.16        | Q102 (test)    |
| 61020  | Run Them to Ground      | player side scheme, Just. | H3.7, H3.8                                   | HT2, HT3; Q101 |
| 61023  | Grapnel Launcher        | upgrade, Justice          | H3.14                                        | HT9            |
| 61027  | Unbreakable Bond        | event, Basic              | H3.1; DSL (Team-Up, divided heal)            | none           |
| 61029  | Defend Our City         | player side scheme, Basic | H3.18; DSL (Team-Up search, cost −1)         | HT13           |
| 61034  | Innate Aggression       | upgrade, Aggression       | H3.17                                        | HT12           |
| 61035  | Shakedown               | upgrade, Aggression       | H3.19                                        | none           |
| 61036  | Innate Perception       | upgrade, Justice          | H3.17                                        | HT12           |
| 61037  | Innate Inspiration      | upgrade, Leadership       | H3.17                                        | HT12           |
| 61038  | Echo                    | ally, Protection          | H3.1, H3.23                                  | none           |
| 61040  | Mitigated Threat        | upgrade, Protection       | H3.11; DSL (`losesIcon`, end-of-round spend) | HT6            |

**DSL only, no blocker:** 61001b Jessica Jones (setup, no change back this phase); 61006 Snooping Around (discard top,
reveal by type); 61011 Leather Jacket (+2 DEF, after you defend); 61012 "Now I'm Ticked Off!" (villain activates, change
form, damage); 61013 Reluctant Flier ((defense) interrupt); 61030 Work-Life Balance (`formChangeCost`, option costs);
61032 Indomitable Will (hinder per player, counters); 61033a Suggestion (energy) (`forcedAction`, uses, play by icon);
61033b Suggestion (mental) (as 61033a); 61033c Suggestion (physical) (as 61033a); 61015 Captain Marvel (discard 4,
printed energy); 61016 Spider-Woman (limb counters to 8); 61019 Strategy Session (choose a player, search; thwart a
PSS); 61024 Entrapment (`threatPlaced` of the activation); 61025 Hellcat (gained action, put into play); 61026 Joys of
Life (Alliance, option costs); 61028 Second Chance (identity-specific cards shuffled in); 61039 Lay Low (change form,
heal REC).

**Reprints, nothing to script:** 61018 Lay Down the Law (12031), 61021 Lay the Trap (41016), 61022 Determination
(21052).

### H7.2 Luke Cage (`luke_cage`)

| Id     | Title                   | Type / aspect        | Needs                                      | Blocker   |
| ------ | ----------------------- | -------------------- | ------------------------------------------ | --------- |
| 62001a | Luke Cage               | hero                 | H3.2, H3.3                                 | HT1; Q103 |
| 62001b | Luke Cage               | alter-ego            | H3.2; DSL (search a named card)            | none      |
| 62002  | Jessica Jones           | ally                 | H3.1; DSL (+THW per tough, max 4)          | none      |
| 62007  | Fogwell's Gym           | support              | H3.2                                       | none      |
| 62009  | Cruisin' for a Bruisin' | upgrade              | H3.15; DSL (engage attached minion)        | HT10      |
| 62010  | Metal Bracer            | upgrade              | H3.23; DSL (retaliate 1, reduce by 1)      | none      |
| 62011  | Power Man               | upgrade              | H3.2                                       | none      |
| 62028  | Internal Injury         | obligation           | H3.3                                       | HT1; Q103 |
| 62031  | Augmented Jaws          | attachment (nemesis) | H3.2; DSL (Cottonmouth, otherwise villain) | none      |
| 62033  | Sidewinder              | minion (nemesis)     | H3.21; DSL (quickstrike, deal self)        | HT15      |
| 62014  | Valkyrie                | ally, Leadership     | H3.1, H3.23                                | none      |
| 62015  | Take a Stand            | event, Leadership    | H3.9                                       | HT4       |
| 62022  | Dynamic Duo             | event, Basic         | H3.20                                      | HT14      |

**DSL only, no blocker:** 62003 Harlem's Hero (give tough, ready per tough); 62004 Knuckle Sandwich (discard a tough,
return to hand); 62005 "Stand with Me!" (give tough, thwart per tough); 62006 "Sweet Christmas!" (cost −1 per tough);
62008 Burstein Process (1 tough, 2 if none); 62029 Cottonmouth (two more attacks, deal self as boost); 62030 Venomous
Whispers (cannot be attacked, discard until); 62032 Asp (stun after scheming); 62012 Iron Fist (prevent by own ATK);
62013 Misty Knight (toughness, +2/+2 while tough); 62018 Defensive Formation (uses, tough to a Defender ally); 62019
Righteous Purpose (exactly 1 hit point remaining); 62020 Hulk (rage counters; data: dash THW); 62021 She-Hulk
(toughness, tough to your identity); 62023 Power Man and Iron Fist (Team-Up, tough to a character); 62034 Size Advantage
(Giant or more remaining hit points); 62035 Observe (the villain schemes, give tough); 62036 Toughen Up (after you
recover, base hit points); 62037 Black Belt (play only if, gains Martial Artist).

**Reprints, nothing to script:** 62016 Innovation (21058), 62017 The Power of Leadership (01072), 62024 Unbreakable Bond
(61027), 62025 Energy (01088), 62026 Genius (01089), 62027 Strength (01090).

---

## H8. Build order

Data (H8.1), then engine tasks one at a time (H8.2), then scripting modules (H8.4), at most three at once where files do
not overlap. The "verify" rows of H3 are proven by the scripting agents' tests.

### H8.1 Data (`card-data-pipeline`)

1. `curation/jj.ts` with the H1 corrections for 61002, 61031, 61033a–c; register and emit.
2. `curation/luke_cage.ts` with 62020's dash THW; emit after `jj`; register.
3. 61040's host after HT6; the two stand-in starter decks, `verified: false`.
4. `docs/team-ups.md` rows (Jessica Jones and Luke Cage; Iron Fist and Luke Cage); `WAVE11_*` exports with the box
   pass's data step.

### H8.2 Engine tasks (`game-rules-architect`), one primitive each

None of `unpreventable`, `skipNextVillainPhase`, `endOfPlayerPhase`, `highestStatAmong`, `anyCard`, `atEndOfThwart`,
`withoutExhausting`, `attackKeywords.target`, `asIfInHand`, `namedByTeamUpOf` or a public boost-ability query exists
(grep, this session).

| Task | Title                                                                              | Section | After |
| ---- | ---------------------------------------------------------------------------------- | ------- | ----- |
| HT1  | `unpreventable` on `dealDamage` / `takeDamage` (Q103 at A)                         | H3.3    |       |
| HT2  | `skipNextVillainPhase` and the round's end (Q101 at A)                             | H3.7    |       |
| HT3  | `nextVillainPhaseBegins` in the DSL's `applyRuleUntil`                             | H3.8    | HT2   |
| HT4  | `endOfPlayerPhase` lasting duration                                                | H3.9    |       |
| HT5  | `highestStatAmong` over the other characters, as a `setBase`                       | H3.10   |       |
| HT6  | `AttachmentHost anyCard`: schema, parser, engine host list                         | H3.11   |       |
| HT7  | `atEndOfThwart` with the thwart's results                                          | H3.12   |       |
| HT8  | `spendCounters.amount` as a value, reading a target chosen with the cost           | H3.5    |       |
| HT9  | `basicPowerBy`: your hero, `withoutExhausting`, `ignores` for the use              | H3.14   |       |
| HT10 | `attackKeywords.target`; constant extra damage for attacks against a character     | H3.15   |       |
| HT11 | `asIfInHand` on a deck play, logged `countsAsFrom: "hand"` (Q102 at A)             | H3.16   |       |
| HT12 | Starting: one per deck, the setup search before step 14 (dedupe with the box pass) | H3.17   |       |
| HT13 | Prerequisite (form or trait) in `canPlay`                                          | H3.18   |       |
| HT14 | `namedByTeamUpOf(ref)` for a deck and discard search                               | H3.20   |       |
| HT15 | A public "has a printed Boost ability" query fragment                              | H3.21   |       |

Order: HT1 first (Luke Cage's identity), HT2 then HT3, the rest in any order; HT12 to whichever pass gets there first.

### H8.4 Scripting modules (`ability-scripting-engineer`), one module per line

Paths under `packages/cards/src/wave11/`. "Waits on" names H8.2 tasks; a line with none starts once its pack is emitted.
The wave scaffold (registries, `card-groups.ts`, coverage guard, `reprints.ts`) is the box pass's first line.

- **HS0.** Registry entries for `jj` and `luke_cage`; the H1 reprint rows. Waits on nothing.
- **HS1.** `jj/jessica-jones/identity` (61001a/b, 61002). Nothing.
- **HS2.** `jj/jessica-jones/events` (61004–61007; 61007 is a player side scheme kept here). Nothing.
- **HS3.** `jj/jessica-jones/support-upgrades-allies` (61003, 61008–61014). HT7, HT8, HT11.
- **HS4.** `jj/jessica-jones/obligation-nemesis` (61030–61033c). HT5.
- **HS5.** `jj/justice` (61015–61017, 61019, 61020, 61023, 61024, 61036). HT2, HT3, HT9, HT12.
- **HS6.** `jj/other-aspects` (61034, 61035, 61037–61040). HT6, HT12.
- **HS7.** `jj/basic` (61025–61029). HT13.
- **HS8.** Jessica Jones starter deck e2e game with Purple Man's set.
- **HS9.** `luke_cage/luke-cage/identity` (62001a/b). HT1.
- **HS10.** `luke_cage/luke-cage/events` (62003–62006). Nothing.
- **HS11.** `luke_cage/luke-cage/support-upgrades-allies` (62002, 62007–62011). HT10.
- **HS12.** `luke_cage/luke-cage/obligation-nemesis` (62028–62033). HT1, HT15.
- **HS13.** `luke_cage/leadership` (62012–62015, 62018, 62019). HT4.
- **HS14.** `luke_cage/other-aspects-basic` (62020–62023, 62034–62037). HT14.
- **HS15.** Luke Cage starter deck e2e game with Cottonmouth's set.
- **HS16.** A two-player game with both heroes: the stand-in at setup, the allies blocked, Unbreakable Bond played.

HS1–HS7 share no file, nor HS9–HS14; HS0 lands first.
