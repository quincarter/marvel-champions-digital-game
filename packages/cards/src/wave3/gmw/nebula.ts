import { trait } from "@mc/content";
import {
  addCounters,
  atEndOfActivation,
  attachCard,
  boost,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  defineAbilities,
  discardAtRandom,
  discardEncounterCards,
  discardEncounterUntil,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  eventSource,
  exhaustCardsCost,
  firstPlayer,
  firstPlayerAction,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  gainsKeyword,
  gets,
  giveBoostCard,
  giveTough,
  hasStatus,
  ifThen,
  modifyAttack,
  moveCards,
  named,
  on,
  option,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  refMatches,
  removeCountersFrom,
  resolveSpecials,
  resolveSpecialsOf,
  revealCard,
  rule,
  self,
  selectCards,
  setup,
  special,
  spendUpTo,
  stun,
  sum,
  takeDamage,
  theMainScheme,
  theVillain,
  thatPlayer,
  topOfDeck,
  varOf,
  whenRevealed,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

/**
 * Nebula: the villain Nebula I–III (16088–16090), the main scheme The Art of Evasion → Warp Drive Initiated
 * (16091a/16091b–16092a/16092b), the Nebula encounter set (16093–16101: Nebula's Ship, the five Technique
 * attachments Cutthroat Ambition/Evasive Maneuvering/Unyielding Persistence/Weapon Mastery/Wide Stance, the side
 * scheme Lethal Intent, the treacheries Barrel Roll/Combat Ready), the Power Stone modular set's own card
 * (16149 — shared with Ronan the Accuser, scripted once here since this is its first scenario), and the Space
 * Pirates modular set (16138–16141, MC16 p. 14's own recommended modular for this scenario, confirmed directly on
 * 16091a's own printed "Contents" text). Ship Command's own cards are scripted elsewhere (`ship-command.ts`).
 *
 * **"Attach the Power Stone to Nebula" (16091a's own Setup text) is not scripted.** The Power Stone (16149) prints
 * the `setup` keyword and `attachesTo: { kind: "villain" }`, so RRG 1.8 Appendix II step 11 ("every card with the
 * setup keyword begins the game in play") already auto-attaches it to the villain, *before* the main scheme's own
 * Setup ability frames run (`setup-steps.ts`'s `putSetupCardsIntoPlay`, called ahead of the villain/main-scheme
 * setup-ability frames) — the same "explicit clause restates an engine default" reading `gmw/escape-the-museum.ts`'s
 * Collector docblock already used for the dial-reset text. Ronan the Accuser's own Setup text ("Attach the Power
 * Stone to the first player") is *not* redundant — a different host than the villain-default — and is scripted on
 * that scenario's own main scheme once it lands.
 *
 * **"Nebula initiates an activation against you"** (16088–16090's own Forced Interrupt) is scripted as
 * `on.enemySchemesOrAttacks("self")` with no extra "against you" filter: RRG 1.8 "Villain Phase" (p. 47) step 2a,
 * "the villain activates against the player" — a villain (unlike a minion) has no engaged player to filter by, so
 * every one of its own activations is already "against" exactly the player it is resolving against, and the
 * ability's own effects read that player as "you" through the ordinary encounter-card "no controller" binding
 * (`resolve/triggers.ts`'s `matchesPattern`): matching `playerIs: "controller"` with no explicit `usesAttackedPlayer`
 * scoping would be a no-op filter here, so it is omitted rather than written for no effect.
 *
 * **The Power Stone's Forced Response is scripted as a raw `EventPattern`,** not `on.damage`, because the
 * "3 or more damage … with a single attack" clause needs `eventAtLeast: { amount: 3 }` alongside `targetIs:
 * { hostOfSelf: true }` and `fromAttack: true` — the exact shape `packages/engine/src/power-stone.test.ts`
 * (docs/phase7-wave3.md §3.19) already proved. No DSL builder wraps this specific combination; composed inline.
 *
 * **DSL builders added this pass:** `resolveSpecialsOf` (`dsl/effects.ts`) — the engine's `resolveSpecials` already
 * carried an `of: TargetRef` field (a card named directly, not found by query) for exactly this shape, needed
 * because a Technique attachment is not unique (`quantityInSet: 2` on two of the five), so "resolve *its* Special
 * ability" after attaching it (the five Technique's own Boost body) has to name the specific instance, not "any
 * Technique in play" (which could resolve a different, already-attached copy of the same card). `spendUpTo`
 * (`dsl/abilities.ts`) — the engine's `AbilityCost.resourcesX` already supported `resource: "any"` with a `max`
 * and no `min` (docs/phase7-wave3.md §3.25, built for this very card, Nebula's Ship's own "Shoot the Thrusters!"),
 * with no DSL wrapper yet; `spendX` is the wrong shape (a single named type, `min` defaulting to 1).
 *
 * No genuine primitive gaps this pass: every `gmw` primitive Nebula needs (§3.2, §3.7, §3.8, §3.13, §3.15, §3.19,
 * §3.25) had already landed for `stld`/`gam`/`vnm` before this session began.
 */

const TECHNIQUE = trait("TECHNIQUE");
const CRIMINAL = trait("CRIMINAL");
const TECHNIQUE_IN_PLAY = query("attachment", { trait: TECHNIQUE, host: theVillain });
const NEBULAS_SHIP = named("Nebula's Ship");
const evasionCounters = countersOn(NEBULAS_SHIP, "evasion");
const exhaustMilano = exhaustCardsCost(query("support", { name: "Milano" }));

/** "The first Technique attachment revealed each round gains surge." (Nebula I/II/III, identical text.) */
const firstTechniqueGainsSurge = () =>
  constant(rule({ kind: "firstRevealGainsSurge", cards: query("attachment", { trait: TECHNIQUE }), each: "round" }));

/** "[star] Boost: After this activation ends, attach this card to Nebula and resolve its 'Special' ability." —
 * identical text on all five Technique attachments (module docblock: `resolveSpecialsOf(self)`, not the query
 * form, since a non-unique Technique's own boost body must name this exact instance). */
const techniqueBoost = () => boost(atEndOfActivation(attachCard(self, theVillain), resolveSpecialsOf(self)));

export const NEBULA = defineAbilities({
  // Villain: Nebula I/II/III (16088–16090) -------------------------------------------------------------------

  "16088.nebula-constant": firstTechniqueGainsSurge(),
  // Nebula I — Forced Interrupt: resolve the "Special" ability on each Technique attachment in play, then discard
  // each of those attachments.
  "16088.nebula-forced-interrupt": forcedInterrupt(
    on.enemySchemesOrAttacks("self"),
    resolveSpecials(TECHNIQUE_IN_PLAY),
    moveCards(cards(each(TECHNIQUE_IN_PLAY)), "discard"),
  ),

  "16089.nebula-constant": firstTechniqueGainsSurge(),
  // Nebula II — same Forced Interrupt as I, but "then choose and discard 1 of those attachments" instead of
  // discarding all of them.
  "16089.nebula-forced-interrupt": forcedInterrupt(
    on.enemySchemesOrAttacks("self"),
    resolveSpecials(TECHNIQUE_IN_PLAY),
    chooseTarget("technique", TECHNIQUE_IN_PLAY),
    moveCards(cards(chosen("technique")), "discard"),
  ),

  "16090.nebula-constant": firstTechniqueGainsSurge(),
  // Nebula III — same Forced Interrupt as I/II, but the choose-and-discard step is gated behind "you may remove
  // the top card of your deck from the game" (a cost-shaped either/or, the module docblock's `chooseOne`).
  "16090.nebula-forced-interrupt": forcedInterrupt(
    on.enemySchemesOrAttacks("self"),
    resolveSpecials(TECHNIQUE_IN_PLAY),
    chooseOne(
      option(
        "Remove the top card of your deck from the game, then choose and discard 1 of those attachments",
        moveCards(topOfDeck(1, you), "removedFromGame"),
        chooseTarget("technique", TECHNIQUE_IN_PLAY),
        moveCards(cards(chosen("technique")), "discard"),
      ),
      option("Do not"),
    ),
  ),

  // Main scheme: The Art of Evasion → Warp Drive Initiated (16091a/16091b–16092a/16092b) ------------------------

  // The Art of Evasion 1A — Setup: Put Nebula's Ship and the Milano into play. "Attach the Power Stone to Nebula"
  // is the engine's own setup-keyword default (module docblock) — not scripted. Discard the top 2[per_hero] cards
  // of the encounter deck, then attach each Technique attachment discarded this way to Nebula.
  "16091a.setup": setup(
    selectCards("ship", encounterCards(["deck"], { name: "Nebula's Ship" })),
    putIntoPlay(chosen("ship"), firstPlayer),
    selectCards("milano", encounterSetAside({ name: "Milano" })),
    putIntoPlay(chosen("milano"), firstPlayer),
    discardEncounterCards(perHero(2), {
      forEachDiscarded: {
        slot: "discarded",
        effects: [
          ifThen(
            refMatches(chosen("discarded"), query("attachment", { trait: TECHNIQUE }), { anywhere: true }),
            attachCard(chosen("discarded"), theVillain),
          ),
        ],
      },
    }),
  ),
  // The Art of Evasion 1B — X is equal to the number of evasion counters on Nebula's Ship.
  "16091b.the-art-of-evasion-constant": constant(
    gets("acceleration", evasionCounters, { self: true }, { setBase: true }),
  ),

  // Warp Drive Initiated 2A — When Revealed: Place 2 evasion counters on Nebula's Ship. For each evasion counter on
  // Nebula's Ship (after placing those 2), discard the top 2 cards of each player deck and the encounter deck.
  "16092a.when-revealed": whenRevealed(
    addCounters("evasion", 2, NEBULAS_SHIP),
    forEachPlayer(eachPlayer, moveCards(topOfDeck(sum(evasionCounters, evasionCounters), thatPlayer), "discard")),
    discardEncounterCards(sum(evasionCounters, evasionCounters)),
  ),
  // Warp Drive Initiated 2B — X is equal to the number of evasion counters on Nebula's Ship. ("If this stage is
  // completed, the players lose the game" is the RRG 1.8 "Villain Defeat" (p. 47) default for a main scheme's
  // final stage completing — no ability ref for it, and none is printed in `abilities` for 16092b either, the same
  // reading `gmw/badoon.ts`'s Protect the Planet 2B and `gmw/museum.ts`'s The Grand Collection 1B docblocks use.)
  "16092b.warp-drive-initiated-constant": constant(
    gets("acceleration", evasionCounters, { self: true }, { setBase: true }),
  ),

  // Nebula's Ship (16093, environment) -----------------------------------------------------------------------

  // Forced Interrupt: When the villain phase begins, place 1 evasion counter here.
  "16093.nebulas-ship-forced-interrupt": forcedInterrupt(on.phaseBeginning("villain"), addCounters("evasion", 1, self)),
  // "Shoot the Thrusters!" — First Player Action: Exhaust the Milano and spend up to 2 resources of any type →
  // remove 1 evasion counter from here for each resource spent this way.
  "16093.nebulas-ship-constant": firstPlayerAction(
    { cost: [exhaustMilano, spendUpTo(2)] },
    removeCountersFrom(self, "evasion", varOf("x")),
  ),

  // Techniques (16094–16098, attachments; Attach to Nebula is data-driven `attachesTo`) --------------------------

  // Cutthroat Ambition — Nebula cannot take more than 5 damage from a single attack. Special: Place 1 threat on the
  // main scheme.
  "16094.cutthroat-ambition-constant": constant(
    rule({ kind: "maxDamageTakenPerAttack", target: { hostOfSelf: true }, amount: 5 }),
  ),
  "16094.cutthroat-ambition-special": special(placeThreat(1, theMainScheme)),
  "16094.boost": techniqueBoost(),

  // Evasive Maneuvering — Nebula gains stalwart. Special: You are stunned. If you are already stunned, give Nebula
  // 1 facedown boost card. (Checked before the stun, the same "already" shape `gmw/museum.ts`'s Psionic Ghost and
  // `gmw/badoon.ts`'s Badoon Sentry both already use.)
  "16095.evasive-maneuvering-constant": constant(gainsKeyword({ name: "stalwart" }, { hostOfSelf: true })),
  "16095.evasive-maneuvering-special": special(
    ifThen(hasStatus(yourIdentity, "stunned"), giveBoostCard(theVillain)),
    stun(yourIdentity),
  ),
  "16095.boost": techniqueBoost(),

  // Unyielding Persistence — Nebula gains stalwart. Special: Give Nebula a tough status card. If Nebula already has
  // a tough status card, give Nebula 1 facedown boost card. (Checked before the give, same shape as above.)
  "16096.unyielding-persistence-constant": constant(gainsKeyword({ name: "stalwart" }, { hostOfSelf: true })),
  "16096.unyielding-persistence-special": special(
    ifThen(hasStatus(theVillain, "tough"), giveBoostCard(theVillain)),
    giveTough(theVillain),
  ),
  "16096.boost": techniqueBoost(),

  // Weapon Mastery — Nebula gains retaliate 1. Special: Take 1 damage.
  "16097.weapon-mastery-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, { hostOfSelf: true })),
  "16097.weapon-mastery-special": special(takeDamage(1, you)),
  "16097.boost": techniqueBoost(),

  // Wide Stance — Reduce the amount of damage Nebula takes from each attack by 1. Special: Discard 1 card at random
  // from your hand.
  "16098.wide-stance-constant": constant(
    rule({ kind: "reduceDamageTaken", target: { hostOfSelf: true }, amount: 1, fromAttack: true }),
  ),
  "16098.wide-stance-special": special(discardAtRandom(1, you)),
  "16098.boost": techniqueBoost(),

  // Lethal Intent (16099, side scheme) -----------------------------------------------------------------------

  // When Revealed: Discard cards from the top of the encounter deck until a Technique attachment is discarded.
  // Reveal that card.
  "16099.when-revealed": whenRevealed(
    discardEncounterUntil(query("attachment", { trait: TECHNIQUE }), "found"),
    revealCard(chosen("found"), you),
  ),

  // Barrel Roll (16100, treachery) ----------------------------------------------------------------------------

  // Incite 1. Surge. (Data.) When Revealed: Place 1 evasion counter on Nebula's Ship. [star] Boost: Place 1
  // evasion counter on Nebula's Ship.
  "16100.when-revealed": whenRevealed(addCounters("evasion", 1, NEBULAS_SHIP)),
  "16100.boost": boost(addCounters("evasion", 1, NEBULAS_SHIP)),

  // Combat Ready (16101, treachery) --------------------------------------------------------------------------

  // When Revealed: Discard cards from the top of the encounter deck until a Technique attachment is discarded.
  // Reveal that card, then resolve its "Special" ability.
  "16101.when-revealed": whenRevealed(
    discardEncounterUntil(query("attachment", { trait: TECHNIQUE }), "found"),
    revealCard(chosen("found"), you),
    resolveSpecialsOf(chosen("found")),
  ),

  // Space Pirates (modular: 16138–16141) ---------------------------------------------------------------------

  // Pirate Commander — Quickstrike (data). Forced Response: After this minion attacks and damages you, remove 1
  // card at random in your hand from the game. [star] Boost: Give the villain 1 additional boost card for this
  // activation.
  "16138.pirate-commander-forced-response": forcedResponse(
    on.enemyAttacks("self", { damages: true }),
    moveCards(zone("hand", you, { random: 1 }), "removedFromGame"),
  ),
  // "Give the villain 1 additional boost card for this activation" is `modifyAttack({ extraBoostCards })`, not
  // `giveBoostCard` (which deals a facedown card *outside* an activation, flipped next time — the validator
  // rejects `giveBoostCard` inside a Boost ability for exactly this reason; `dsl/effects.ts`'s own docblock).
  "16138.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  // Pirate Lackey — Quickstrike (data). Forced Response: After this minion attacks and damages you, remove the top
  // card of your deck from the game. [star] Boost: Give the villain 1 additional boost card for this activation.
  "16139.pirate-lackey-forced-response": forcedResponse(
    on.enemyAttacks("self", { damages: true }),
    moveCards(topOfDeck(1, you), "removedFromGame"),
  ),
  "16139.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  // Sound the Alarms — Each enemy gets +1 ATK. [star] Boost: Reveal this card.
  "16140.sound-the-alarms-constant": constant(gets("atk", 1, query("enemy"))),
  "16140.boost": boost(revealCard(self, firstPlayer)),

  // Honor Among Thieves — When Revealed: Discard cards from the top of the encounter deck until a Criminal minion
  // is discarded. Reveal that minion, then give that minion a tough status card and the villain 1 facedown boost
  // card.
  "16141.when-revealed": whenRevealed(
    discardEncounterUntil(query("minion", { trait: CRIMINAL }), "found"),
    revealCard(chosen("found"), you),
    giveTough(chosen("found")),
    giveBoostCard(theVillain),
  ),

  // Power Stone (16149, modular; shared with Ronan the Accuser) ------------------------------------------------

  // "Setup. Attach to the villain." is data-driven (module docblock). Permanent (data).
  // Forced Response: After a hero or villain deals 3 or more damage to attached character with a single attack,
  // attach Power Stone to the attacking hero or villain (module docblock: raw `EventPattern`, matches
  // `power-stone.test.ts`).
  "16149.power-stone-forced-response": forcedResponse(
    { on: "dealDamage", targetIs: { hostOfSelf: true }, fromAttack: true, eventAtLeast: { amount: 3 } },
    attachCard(self, eventSource),
  ),
});
