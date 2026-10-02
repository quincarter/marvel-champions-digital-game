import { trait } from "@mc/content";
import {
  after,
  alterEgoResponse,
  anyOf,
  attachCard,
  attackInProgress,
  attacksGainKeywords,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  costModifier,
  defeatingPlayer,
  defineAbilities,
  draw,
  each,
  eventTarget,
  exhaustThis,
  exists,
  gainsTrait,
  gets,
  hasTrait,
  heroResource,
  identityOf,
  losesKeyword,
  moveCards,
  not,
  ofIdentitySetTitled,
  playersWhere,
  query,
  ready,
  response,
  rule,
  shuffleDeck,
  takesFirstTurn,
  thatAttackGainsKeywords,
  thatPlayer,
  on,
  useThwInsteadOfAtk,
  when,
  interrupt,
  encounterCards,
  you,
  youHaveTrait,
  zone,
} from "../../../dsl/index.js";

const X_MEN = trait("X-MEN");
const MUTANT = trait("MUTANT");
const TRAINING = trait("TRAINING");
const CYCLOPS_CARD = ofIdentitySetTitled("Cyclops");
const AN_X_MEN_ALLY = query("ally", { trait: X_MEN });
const AN_X_MEN_CHARACTER = query("character", { trait: X_MEN });
const THE_HOST_ENEMY = { hostOfSelf: true } as const;
const THE_HOST_ALLY = query("ally", { hostOfSelf: true });
const THE_HOST_MINION = query("minion", { hostOfSelf: true });

/** "Any player whose alter-ego has the MUTANT trait" (Danger Room, docs/phase7-wave6.md §3.11). */
const MUTANT_ALTER_EGO = playersWhere(hasTrait(identityOf(thatPlayer), MUTANT));

/**
 * Cyclops's supports, upgrades and allies (`cyclops` 33002-33007, 33011-33016, 33019-33021, 33032-33035;
 * docs/phase7-wave6.md §3.26-§3.28, §3.44). His events and resources are `events.ts`.
 *
 * - **Ruby Quartz Visor (33003)**: a hero resource "for your 'Optic Blast' ability" generates only for Cyclops's
 *   identity (Optic Blast is its one ability that costs resources; an ability's payment is for its own card,
 *   docs/phase7-wave6.md §3.30), and "that attack gains piercing and ranged" lasts only while the ability it paid for
 *   resolves (`thatAttackGainsKeywords`, `until: "endOfPaidFor"`).
 * - **Field Commander (33004)**: `takesFirstTurn(you)` (§3.27, read as the player phase begins, §4.1 Q16) and "each
 *   Cyclops upgrade attached to a minion loses the temporary keyword" (§3.13 over §3.26): a Cyclops upgrade is one of
 *   his identity set, whoever controls it, and its host must be a minion.
 * - **Exploit Weakness / Practiced Defense / Priority Target (33005-33007)**: "Attach to an enemy. Max 1 per enemy"
 *   (`maxPerHost`) and Temporary (the engine's keyword rule, §3.26) are card data. Exploit Weakness adds 1 to each
 *   damage event of each attack on its host (the Ricochet Beam FAQ, RRG 1.8 p. 64: per damage event). Priority
 *   Target's "the player who defeated it" is `defeatingPlayer`.
 * - **Danger Room Training (33015)**: "Max 1 TRAINING upgrade per ally" is `maxWithTrait` (§3.28), card data.
 * - **Marked (33032)**: overkill for every attack against its host, whoever makes it, read while that attack is in
 *   progress (`attackInProgress`).
 * - **Utopia (33020)**: "if each of your allies has X-MEN" is vacuously true with no allies (the Avengers Tower
 *   reading). **Danger Room (33021)**: `triggerableBy` (§3.11); the searcher is the triggering player ("you").
 * - **Angel (33019)**: the cost reduction is read from hand (Colossus 32048's shape).
 * - **Rockslide (33013)**: Retaliate 1 is a printed keyword (card data).
 * - **Blindfold (33014)**: choose 1 of the top 5 encounter cards to discard, the other four stay as they were (a
 *   `chooseCards` over the top 5, whose prompt shows them).
 */
export const CYCLOPS_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  "33002.phoenix-response": response(
    after.entersPlay("self"),
    chooseCards(
      "found",
      zone("discard", you, { filter: query(["ally", "event", "support", "upgrade", "resource"], CYCLOPS_CARD) }),
      {
        min: 1,
        max: 1,
      },
    ),
    moveCards(cards(chosen("found")), "hand"),
  ),

  "33003.ruby-quartz-visor-resource": heroResource(
    { energy: 1 },
    { cost: exhaustThis, generatesFor: query("identity", { name: "Cyclops", controller: "you" }) },
    thatAttackGainsKeywords(["piercing", "ranged"]),
  ),

  "33004.field-commander-constant": constant(takesFirstTurn(you)),
  "33004.field-commander-constant-2": constant(
    losesKeyword({ name: "temporary" }, query("upgrade", { ...CYCLOPS_CARD, host: each(query("minion")) })),
  ),

  "33005.exploit-weakness-constant": constant(
    rule({ kind: "increaseDamageTaken", target: THE_HOST_ENEMY, amount: 1, fromAttack: true }),
  ),
  "33006.practiced-defense-constant": constant(gets("atk", -1, THE_HOST_ENEMY)),
  "33007.priority-target-interrupt": interrupt(when.defeated("host"), draw(2, defeatingPlayer)),

  "33011.beast-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone(["deck", "discard"], you, { filter: query("resource") }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  "33014.blindfold-response": response(
    after.entersPlay("self"),
    chooseCards("found", encounterCards(["deck"], undefined, 5), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "discard"),
  ),

  "33015.danger-room-training-constant": constant(
    gets("thw", 1, THE_HOST_ALLY),
    gets("atk", 1, THE_HOST_ALLY),
    gets("hp", 1, THE_HOST_ALLY),
  ),

  "33019.angel-constant": constant(
    costModifier({
      delta: -1,
      appliesTo: query("ally", { self: true }),
      while: anyOf(youHaveTrait(MUTANT), youHaveTrait(X_MEN)),
      activeIn: "hand",
    }),
  ),

  "33020.utopia-constant": constant(
    rule({
      kind: "allyLimit",
      amount: 1,
      while: not(exists(query("ally", { controller: "you", withoutTrait: X_MEN }))),
    }),
  ),
  "33020.utopia-response": response(
    after.entersPlay(AN_X_MEN_ALLY),
    { cost: exhaustThis },
    chooseTarget("xmen", AN_X_MEN_CHARACTER),
    ready(chosen("xmen")),
  ),

  "33021.danger-room-response": alterEgoResponse(
    after.entersPlay(AN_X_MEN_ALLY),
    { cost: exhaustThis, triggerableBy: MUTANT_ALTER_EGO },
    chooseCards("found", zone(["deck", "discard"], you, { filter: query("upgrade", { trait: TRAINING }) }), {
      min: 0,
      max: 1,
    }),
    attachCard(chosen("found"), eventTarget),
    shuffleDeck(),
  ),

  "33032.marked-constant": constant(
    attacksGainKeywords(["overkill"], { while: attackInProgress({ target: THE_HOST_MINION }) }),
  ),
  // Befuddle: "Interrupt" (optional), the basic attack stays a basic attack made with THW (§3.32, Q22).
  "33033.befuddle-interrupt": interrupt(
    on.attacks({ categories: ["character"] }, { target: THE_HOST_MINION, basic: true }),
    useThwInsteadOfAtk(),
  ),
  "33034.pinned-down-constant": constant(gets("atk", -2, THE_HOST_MINION)),
  "33035.honorary-x-men-constant": constant(
    gets("hp", 1, { hostOfSelf: true }),
    gainsTrait(X_MEN, { hostOfSelf: true }),
  ),
});
