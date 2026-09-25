import type { Predicate, RuleSpec } from "@mc/engine";
import {
  allOf,
  atEndOfActivation,
  attachCard,
  constant,
  coveredByEngineRule,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  enemyAttack,
  enemyScheme,
  eventDealt,
  eventTarget,
  firstPlayer,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  ifThen,
  moveCards,
  named,
  on,
  oneCopyOf,
  otherPlayers,
  placeThreat,
  query,
  refMatches,
  revealCard,
  rule,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  theMainScheme,
  theVillain,
  victoryDisplayCount,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  boost,
  chosen,
  dealEncounterCard,
  dealIndirectDamage,
  detach,
  endGame,
  giveBoostCard,
  modifyAttack,
} from "../../dsl/index.js";

/**
 * Hela (`mts` 21136–21151; MC21 p. 20): the double-sided Hela villain (standard 21136a/b, expert 21137a/b), her main
 * scheme Odin's Torment (21138), the captive/king ally Odin (21139), the three side schemes that chain minions into
 * play (21140–21142), the three minions that guard them (21143–21145), Hela's own attachments (21146–21148) and
 * treacheries (21149–21151). Legions of Hel and Frost Giants (the scenario's two recommended modular sets,
 * 21152+) are out of scope here (a later pass, per `../coverage.test.ts`'s own `KNOWN_SKIPPED`), and so are Thanos
 * and Loki's own cards, scripted alongside this one.
 *
 * **The win/loss shape (MC21 p. 20).** Hela begins on her Mystic side (21136a/21137a). "When Hela would be
 * defeated, if Odin is attached to this scheme [the main scheme], discard each attachment from Hela and flip her to
 * her Wounded side instead" (21138b's own Forced Interrupt) — the same "flip instead of dying" shape as Escape the
 * Museum's Collector (docs/phase7-wave3.md §3.1, `gmw/escape-the-museum.ts`): an interrupt to `characterDefeated`
 * that flips before the engine's own defeat sweep applies, so the flip (which resets the hit point dial per that
 * same engine rule) replaces the defeat outright. Wounded Hela (21136b/21137b) "cannot be defeated" and flips back
 * to Mystic "after a side scheme is defeated" (any side scheme, not just her own — `on.schemeDefeated`). If Hela is
 * ever defeated for real (only possible with Odin *not* attached to the main scheme, since the interrupt above
 * would otherwise have intercepted it), the players win (21136a/21137a's own `whenDefeated`, `hela-constant-2`).
 *
 * **`21136a.hela-constant`/`21137a.hela-constant` (the whole first sentence, "gets +1 SCH, +1 ATK and +2[per_hero]/
 * +3[per_hero] hit points for each side scheme in victory display") is a genuine DSL/engine gap, left in
 * `KNOWN_SKIPPED`.** The SCH/ATK clauses alone are `scaled(victoryDisplayCount(query("sideScheme")), { times: 1 })`
 * (or `{times: N}`) — easy. The hit point clause needs the *product* of two values that are each only known at
 * read time: "N per hero" (`ValueSpec.perPlayer`, scaled by the live player count) and "the number of side schemes
 * in victory display right now" (`ValueSpec.count`/`victoryDisplayCount`). `ValueSpec scaled`'s own `times` field is
 * a compile-time `number`, and no `ValueSpec` kind multiplies two other `ValueSpec`s together — every existing
 * scaling primitive (`scaled`, `perPlayer`, `sum`, `min`/`max`) combines a dynamic value with either a constant or
 * another *pre-computed* dynamic value, never two dynamic values as a product. Since this ref's *one* text box
 * bundles the SCH/ATK clauses with the unscriptable HP clause, and "a subtly wrong ability implementation is worse
 * than an unimplemented one" (partial credit here would silently under-scale Hela's hit points), the whole ref stays
 * unscripted rather than half-implementing it. Needs a `game-rules-architect` primitive: a `ValueSpec` kind for the
 * product of two `ValueSpec`s (or a `perPlayer` field that itself accepts a `ValueSpec` for its per-player amount,
 * rather than only a literal `number`).
 *
 * **`21139b.odin-forced-interrupt` ("Forced Interrupt: When Odin leaves play, remove him from the game") needs no
 * script and is left out of the registry (not a gap — nothing to add).** docs/phase7-wave4.md §3.8: Odin is
 * double-sided, and RRG 1.8 "Double-Sided Card" (p. 17) already sends a double-sided card out of the game on
 * `leavePlay`, generically, with no ability hook to attach a redundant no-op effect to (there is no "when this
 * leaves play" trigger exposed to card scripts at all — the removal happens structurally inside `leavePlay` itself).
 * `packages/engine/src/captive-ally.test.ts`'s own Odin-shaped fixture proves the composition directly. Left in
 * `KNOWN_SKIPPED` with this reasoning, distinct from the genuine gap above.
 *
 * **Odin (21139a/b) is scripted exactly on the `captive-ally.test.ts` model** (docs/phase7-wave4.md §3.8, landed
 * 2026-09-24): while not attached to the main scheme, the first player controls him and he doesn't count against
 * the ally limit; he can never take attachments and if he ever leaves play the players lose — both unconditional,
 * per the ruling (Aug 3, 2026 (4) #1) and the printed "if Odin leaves play" sentence sitting outside the "while not
 * attached" quotation. The King (flip) side names the same shape unconditionally (never gated on attachment, since
 * a card flipped to King is by definition not attached to anything) and additionally restricts *encounter* cards
 * only (`from: "encounter"`, the printed "cannot have encounter cards attached" on that face specifically, unlike
 * the Captive face's unqualified "cannot have cards attached"). The King side is reached only via `flipCard`, which
 * no `mts` card triggers directly in a standalone Hela game (MC21 p. 20's own setup keeps him Captive throughout;
 * the King side exists on this card for the Loki scenario/campaign carry-over, MC21 p. 24, "put Odin into play on
 * his King side" — out of this task's scope, but the same card record, so its ability refs are scripted here too).
 *
 * **The side-scheme chain (21140–21142) reveals its own next links "the first player reveals … and puts them into
 * play"**: `revealCard(chosen(...), firstPlayer)` for each, which (docs/phase7-wave4.md §3.8's own
 * `enterPlayOnReveal`, `reveal.ts`) engages a revealed minion with *the revealing player* — always `firstPlayer`
 * here, by construction. That is exactly Garm/Skurge/Nidhogg's own printed "X engages the first player"
 * (21143/21144/21145's own `-constant` refs): since these three minions only ever enter play through this
 * scenario's own always-first-player reveals (setup, for Garm; the chained side-scheme defeats, for Skurge and
 * Nidhogg), the printed sentence is already true by construction and needs no override rule —
 * `coveredByEngineRule()`, the same "no ability needed" precedent `wave2/trors/red-skull.ts`'s New World Hydra
 * constant already uses for a similarly-subsumed sentence.
 *
 * **A card-data-pipeline gap, noted but not fixed here (out of scope, `packages/content/**` is off limits):** MC21
 * p. 20's own contents line reads "Villain deck Hela A (Hela B instead for expert mode)" — two distinct printed
 * villain cards (21136 standard, 21137 expert), the same shape `Scenario.expertVillains` already models for Escape
 * the Museum's Collector (`gmw/scenarios.ts`). `MTS_SCENARIOS`'s own `hela` record (`content/src/data/mts/
 * scenarios.ts`) does not set `expertVillains`, so `wave4Scenario("hela", { difficulty: "expert" })` would build
 * with 21136a (the standard villain) regardless of difficulty. This module's own e2e test builds the expert game
 * directly (bypassing `wave4Scenario`) rather than guess at the missing field's value.
 */

// ---------------------------------------------------------------------------
// Villain
// ---------------------------------------------------------------------------

/** "Hela cannot be defeated." (21136b/21137b). */
const helaCannotBeDefeated = () => constant(rule({ kind: "cannotBeDefeated", target: { self: true } }));
/** "Forced Response: After a side scheme is defeated, flip Hela to her mystic side." (21136b/21137b). */
const helaFlipsBackAfterASideSchemeFalls = () => forcedResponse(on.schemeDefeated(query("sideScheme")), flipCard(self));
/** "When Hela is defeated, if Odin is not attached to the main scheme, you win the game" (21136a/21137a). By this
 * point Odin not being attached is the only way Hela's defeat could have resolved for real (21138b's own Forced
 * Interrupt intercepts it otherwise) — checked anyway, literally, rather than assumed. */
const helaWinsIfOdinIsFree = () => whenDefeated(ifThen(NOT_ODIN_ATTACHED, endGame("win")));

const ODIN_ATTACHED: Predicate = { kind: "isAttached", of: named("Odin") };
const NOT_ODIN_ATTACHED: Predicate = { kind: "not", of: ODIN_ATTACHED };

// ---------------------------------------------------------------------------
// Odin's Torment (main scheme)
// ---------------------------------------------------------------------------

/** "Setup: Attach Odin to the main scheme, captive side faceup. Reveal Gnipahellir and Garm. Set Gjallerbru,
 * Skurge, Hall of Nastrond, and Nidhogg aside, out of play. Shuffle the encounter deck." (21138a). Odin enters
 * showing his printed (Captive) face already — no flip needed. "Set … aside" reads as "leave in the shared
 * set-aside area", the same destination `wave3Scenario`'s own Ship Command pattern uses. */
const ODINS_TORMENT_SETUP = setup(
  selectCards("odin", encounterSetAside({ name: "Odin" })),
  attachCard(chosen("odin"), self),
  selectCards("gnipahellir", oneCopyOf(encounterCards(["deck"], { name: "Gnipahellir" }))),
  revealCard(chosen("gnipahellir"), firstPlayer),
  selectCards("garm", oneCopyOf(encounterCards(["deck"], { name: "Garm" }))),
  revealCard(chosen("garm"), firstPlayer),
  moveCards(encounterCards(["deck"], { name: "Gjallerbru" }), "encounterSetAside"),
  moveCards(encounterCards(["deck"], { name: "Skurge" }), "encounterSetAside"),
  moveCards(encounterCards(["deck"], { name: "Hall of Nastrond" }), "encounterSetAside"),
  moveCards(encounterCards(["deck"], { name: "Nidhogg" }), "encounterSetAside"),
  shuffleEncounterDeck(),
);

/** "Forced Interrupt: When Hela would be defeated, if Odin is attached to this scheme, discard each attachment from
 * Hela and flip her to her wounded side instead." (21138b). Modeled on `gmw/escape-the-museum.ts`'s own Collector
 * front interrupt (docs/phase7-wave3.md §3.1): an interrupt to `characterDefeated`, so flipping (which resets the
 * dial, per that same engine rule) replaces the defeat rather than merely reacting to it. */
const ODINS_TORMENT_FORCED_INTERRUPT = forcedInterrupt(
  when.defeated(query("villain")),
  ifThen(ODIN_ATTACHED, [discard(each(query("attachment", { host: eventTarget }))), flipCard(eventTarget)]),
);

// ---------------------------------------------------------------------------
// Odin (ally)
// ---------------------------------------------------------------------------

const NOT_ATTACHED: Predicate = { kind: "not", of: { kind: "isAttached", of: self } };

/** Captive side (21139a): "While Odin is not attached to the main scheme, he gains: 'The first player gains control
 * of Odin. Odin cannot have cards attached and does not count against ally limit.' If Odin leaves play, the players
 * lose the game." Split across the card's own two refs exactly as `packages/engine/src/captive-ally.test.ts`'s own
 * `CAPTIVE` ability composes it: the "while not attached" pair on `-constant`, the unconditional pair (per the
 * ruling and the printed sentence sitting outside the quotation) on `-constant-2`. */
const ODIN_CAPTIVE_CONSTANT = constant(
  rule({ kind: "controlledByFirstPlayer", target: { self: true }, while: NOT_ATTACHED } as RuleSpec),
  rule({ kind: "excludedFromAllyLimit", target: { self: true }, while: NOT_ATTACHED } as RuleSpec),
);
const ODIN_CAPTIVE_CONSTANT_2 = constant(
  rule({ kind: "cannotHaveAttachments", target: { self: true } } as RuleSpec),
  rule({ kind: "leavingPlayLoses", target: { self: true } } as RuleSpec),
);

/** King side (21139b): "The first player gains control of Odin. Odin cannot have encounter cards attached and does
 * not count against the ally limit." Both unconditional on this face (docblock above); the third sentence needs no
 * script (docblock above, `21139b.odin-forced-interrupt` is left unregistered). */
const ODIN_KING_CONSTANT = constant(rule({ kind: "controlledByFirstPlayer", target: { self: true } } as RuleSpec));
const ODIN_KING_CONSTANT_2 = constant(
  rule({ kind: "cannotHaveAttachments", target: { self: true }, from: "encounter" } as RuleSpec),
  rule({ kind: "excludedFromAllyLimit", target: { self: true } } as RuleSpec),
);

// ---------------------------------------------------------------------------
// Side schemes (21140-21142)
// ---------------------------------------------------------------------------

/** Gnipahellir (21140) — "When Defeated: The first player reveals Gjallerbru and Skurg, and puts them into play.
 * Deal each other player 1 facedown encounter card." */
const GNIPAHELLIR_WHEN_DEFEATED = whenDefeated(
  selectCards("gjallerbru", encounterSetAside({ name: "Gjallerbru" })),
  revealCard(chosen("gjallerbru"), firstPlayer),
  selectCards("skurge", encounterSetAside({ name: "Skurge" })),
  revealCard(chosen("skurge"), firstPlayer),
  dealEncounterCard(otherPlayers(firstPlayer)),
);

/** Hall of Nastrond (21141) — "When Defeated: The first player detaches Odin from the main scheme and takes control
 * of him. Deal each player 1 facedown encounter card." Note: "each player", not "each other player" (unlike its two
 * siblings above/below) — checked directly against the printed text. */
const HALL_OF_NASTROND_WHEN_DEFEATED = whenDefeated(detach(named("Odin"), firstPlayer), dealEncounterCard(eachPlayer));

/** Gjallerbru (21142) — "When Defeated: The first player reveals Hall of Nastrond and Nidhogg, and puts them into
 * play. Deal each other player 1 facedown encounter card." */
const GJALLERBRU_WHEN_DEFEATED = whenDefeated(
  selectCards("nastrond", encounterSetAside({ name: "Hall of Nastrond" })),
  revealCard(chosen("nastrond"), firstPlayer),
  selectCards("nidhogg", encounterSetAside({ name: "Nidhogg" })),
  revealCard(chosen("nidhogg"), firstPlayer),
  dealEncounterCard(otherPlayers(firstPlayer)),
);

// ---------------------------------------------------------------------------
// Minions (21143-21145)
// ---------------------------------------------------------------------------

/** "Garm engages the first player." (21143) — covered by construction (module docblock): Garm only ever enters
 * play via this scenario's own always-first-player reveal (setup). */
const ENGAGES_FIRST_PLAYER_BY_CONSTRUCTION = () => coveredByEngineRule();
/** "Threat cannot be removed from Gnipahellir." (21143). */
const THREAT_CANNOT_BE_REMOVED_FROM_GNIPAHELLIR = constant(
  rule({ kind: "threatCannotBeRemoved", target: query("sideScheme", { name: "Gnipahellir" }) }),
);

/** "[star] Skurge's attacks gain piercing." (21144). */
const SKURGE_GAINS_PIERCING = constant(gainsKeyword({ name: "piercing" }, { self: true }));
/** "Threat cannot be removed from Gjallerbru." (21144). */
const THREAT_CANNOT_BE_REMOVED_FROM_GJALLERBRU = constant(
  rule({ kind: "threatCannotBeRemoved", target: query("sideScheme", { name: "Gjallerbru" }) }),
);

/** "[star] Nidhogg's attacks gain overkill." (21145). */
const NIDHOGG_GAINS_OVERKILL = constant(gainsKeyword({ name: "overkill" }, { self: true }));
/** "Threat cannot be removed from Hall of Nastrond." (21145). */
const THREAT_CANNOT_BE_REMOVED_FROM_HALL_OF_NASTROND = constant(
  rule({ kind: "threatCannotBeRemoved", target: query("sideScheme", { name: "Hall of Nastrond" }) }),
);

// ---------------------------------------------------------------------------
// Hela's attachments (21146-21148)
// ---------------------------------------------------------------------------

/** "[star] Hela's attacks gain piercing." (Nightsword, 21146). */
const NIGHTSWORD_CONSTANT = constant(gainsKeyword({ name: "piercing" }, query("enemy", { hostOfSelf: true })));
/** "[star] Forced Response: After Hela schemes, give her a facedown boost card." (Hela's Crown, 21147). */
const HELAS_CROWN_FORCED_RESPONSE = forcedResponse(on.enemySchemes("host"), giveBoostCard());
/** "Hela gains stalwart." (Hela's Cloak, 21148). */
const HELAS_CLOAK_CONSTANT = constant(gainsKeyword({ name: "stalwart" }, query("enemy", { hostOfSelf: true })));
/** "[star] Boost: Attach [this card] to Hela." — shared shape for all three attachments. */
const attachToHelaBoost = () => boost(attachCard(self, theVillain));

// ---------------------------------------------------------------------------
// Treacheries (21149-21151)
// ---------------------------------------------------------------------------

/** "When Revealed: Place 1 threat on the main scheme. Place 1 additional threat on the main scheme for each side
 * scheme in the victory display." (Hela's Domain, 21149). */
const HELAS_DOMAIN_WHEN_REVEALED = whenRevealed(
  placeThreat(1, theMainScheme),
  placeThreat(victoryDisplayCount(query("sideScheme")), theMainScheme),
);
/** "[star] Boost: If damage from this attack defeats an ally, place 2 threat on the main scheme." (Hela's Domain).
 * Modeled on `wave4/mts/tower-defense.ts`'s Rain Fire boost (`atEndOfActivation` + `eventDealt("defeated")` +
 * `refMatches(eventTarget, query("ally"), { anywhere: true })`, since a defeated ally has already left play by the
 * time the activation ends). */
const HELAS_DOMAIN_BOOST = boost(
  atEndOfActivation(
    ifThen(
      allOf(eventDealt("defeated"), refMatches(eventTarget, query("ally"), { anywhere: true })),
      placeThreat(2, theMainScheme),
    ),
  ),
);

/** "When Revealed (Alter-Ego): Hela schemes. Place 1 threat on each side scheme." (The Queen of Hel, 21150). */
const QUEEN_OF_HEL_ALTER_EGO = whenRevealedAlterEgo(enemyScheme(theVillain), placeThreat(1, each(query("sideScheme"))));
/** "When Revealed (Hero): Hela attacks you. Place 1 threat on each side scheme." (The Queen of Hel, 21150). */
const QUEEN_OF_HEL_HERO = whenRevealedHero(
  enemyAttack(theVillain, { against: you }),
  placeThreat(1, each(query("sideScheme"))),
);

/** "When Revealed: Take 1 indirect damage. Take 1 additional indirect damage for each side scheme in the victory
 * display." (The Wastes of Niffleheim, 21151). */
const WASTES_OF_NIFFLEHEIM_WHEN_REVEALED = whenRevealed(
  dealIndirectDamage(you, 1),
  dealIndirectDamage(you, victoryDisplayCount(query("sideScheme"))),
);
/** "[star] Boost: This card gains boost icons ([boost]) equal to the number of side schemes in the victory
 * display." Boost icons translate directly into this activation's ATK (attack) or SCH (scheme) bonus, so both are
 * set to the same dynamic value (`modifyAttack`'s own doc comment: it covers scheme activations too), matching the
 * `atkBonus`/`threatBonus` pattern `wave4/mts/tower-defense.ts`'s Proxima's Power boost already uses for a dynamic
 * per-activation bonus (no direct "gain N boost icons" effect exists to name this literally). */
const WASTES_OF_NIFFLEHEIM_BOOST = boost(
  modifyAttack({
    atkBonus: victoryDisplayCount(query("sideScheme")),
    threatBonus: victoryDisplayCount(query("sideScheme")),
  }),
);

export const HELA = defineAbilities({
  // Hela, Mystic side (standard, 21136a) — scaling ability (`-constant`) is a genuine DSL/engine gap (module
  // docblock), left unscripted/`KNOWN_SKIPPED`. Win condition (`-constant-2`) is scripted.
  "21136a.hela-constant-2": helaWinsIfOdinIsFree(),
  // Hela, Wounded side (standard, 21136b).
  "21136b.hela-constant": helaCannotBeDefeated(),
  "21136b.hela-forced-response": helaFlipsBackAfterASideSchemeFalls(),
  // Hela, Mystic side (expert, 21137a) — same shape as 21136a.
  "21137a.hela-constant-2": helaWinsIfOdinIsFree(),
  // Hela, Wounded side (expert, 21137b) — same shape as 21136b.
  "21137b.hela-constant": helaCannotBeDefeated(),
  "21137b.hela-forced-response": helaFlipsBackAfterASideSchemeFalls(),

  // Odin's Torment (21138a/b).
  "21138a.setup": ODINS_TORMENT_SETUP,
  "21138b.odins-torment-forced-interrupt": ODINS_TORMENT_FORCED_INTERRUPT,

  // Odin, Captive side (21139a).
  "21139a.odin-constant": ODIN_CAPTIVE_CONSTANT,
  "21139a.odin-constant-2": ODIN_CAPTIVE_CONSTANT_2,
  // Odin, King side (21139b) — `-forced-interrupt` needs no script (module docblock), left out of the registry.
  "21139b.odin-constant": ODIN_KING_CONSTANT,
  "21139b.odin-constant-2": ODIN_KING_CONSTANT_2,

  // Side schemes.
  "21140.when-defeated": GNIPAHELLIR_WHEN_DEFEATED,
  "21141.when-defeated": HALL_OF_NASTROND_WHEN_DEFEATED,
  "21142.when-defeated": GJALLERBRU_WHEN_DEFEATED,

  // Minions.
  "21143.garm-constant": ENGAGES_FIRST_PLAYER_BY_CONSTRUCTION(),
  "21143.garm-constant-2": THREAT_CANNOT_BE_REMOVED_FROM_GNIPAHELLIR,
  "21144.skurge-constant": ENGAGES_FIRST_PLAYER_BY_CONSTRUCTION(),
  "21144.skurge-constant-2": SKURGE_GAINS_PIERCING,
  "21144.skurge-constant-3": THREAT_CANNOT_BE_REMOVED_FROM_GJALLERBRU,
  "21145.nidhogg-constant": ENGAGES_FIRST_PLAYER_BY_CONSTRUCTION(),
  "21145.nidhogg-constant-2": NIDHOGG_GAINS_OVERKILL,
  "21145.nidhogg-constant-3": THREAT_CANNOT_BE_REMOVED_FROM_HALL_OF_NASTROND,

  // Hela's attachments.
  "21146.nightsword-constant": NIGHTSWORD_CONSTANT,
  "21146.boost": attachToHelaBoost(),
  "21147.helas-crown-forced-response": HELAS_CROWN_FORCED_RESPONSE,
  "21147.boost": attachToHelaBoost(),
  "21148.helas-cloak-constant": HELAS_CLOAK_CONSTANT,
  "21148.boost": attachToHelaBoost(),

  // Treacheries.
  "21149.when-revealed": HELAS_DOMAIN_WHEN_REVEALED,
  "21149.boost": HELAS_DOMAIN_BOOST,
  "21150.when-revealed-alter-ego": QUEEN_OF_HEL_ALTER_EGO,
  "21150.when-revealed-hero": QUEEN_OF_HEL_HERO,
  "21151.when-revealed": WASTES_OF_NIFFLEHEIM_WHEN_REVEALED,
  "21151.boost": WASTES_OF_NIFFLEHEIM_BOOST,
});
