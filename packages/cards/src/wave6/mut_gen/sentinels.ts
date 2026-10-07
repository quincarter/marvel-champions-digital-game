import { trait } from "@mc/content";
import {
  action,
  allOf,
  boost,
  cannotThwart,
  constant,
  controllerOf,
  dealAsEncounterCard,
  defineAbilities,
  discard,
  each,
  enemyAttack,
  exhaustYourHero,
  exists,
  ifThen,
  isAttached,
  isHero,
  not,
  playersWhere,
  query,
  rule,
  searchAndReveal,
  self,
  surge,
  thatPlayer,
  whenRevealed,
  you,
  yourIdentity,
} from "../../dsl/index.js";

const SENTINEL = trait("SENTINEL");
const TARGETED = "Targeted for Elimination";
/** "Targeted for Elimination is attached to your identity." */
const MARKED_YOU = query("attachment", { name: TARGETED, host: yourIdentity });
/** The identity Targeted for Elimination is attached to. */
const MARKED_IDENTITY = query("identity", { hasAttachment: { name: TARGETED } });

/**
 * The Sentinels modular set (`sentinels`, `mut_gen` 32105-32108, MC32 p. 9 / p. 12, docs/phase7-wave6.md §2.2): Sentinel
 * Mark V, Sentinel Mark VI, Targeted for Elimination and Relentless Robots. Quickstrike is a data keyword.
 *
 * **Mark V**: its attack is `enemyAttack`, an attack whatever the target's form ("even if you are in alter-ego form",
 * `wave5/nova/obligation-nemesis.ts` War Delivery). **Mark VI**: "deal this card to that player" goes to the first
 * player whose identity carries the attachment (`dealAsEncounterCard` deals to the first player named; the printed
 * text does not say which player when several identities are marked). The boost card is dealt from the boost area and
 * revealed in that villain phase's reveal step.
 * **Targeted for Elimination**: attaches to your identity without a copy (data); the "otherwise surge" is its When
 * Revealed (`wave4` §3.58); "you" on the attachment is the host's controller, as on Wrapped in Metal.
 */
export const SENTINELS_ABILITIES = defineAbilities({
  // Sentinel Mark V (32105) — When Revealed: If Targeted for Elimination is attached to your identity, Sentinel Mark V
  // attacks you (even if you are in alter-ego form). Otherwise, search the encounter deck and discard pile for the
  // Targeted for Elimination attachment and reveal it.
  "32105.when-revealed": whenRevealed(
    ifThen(exists(MARKED_YOU), enemyAttack(self, { against: you }), searchAndReveal(TARGETED)),
  ),

  // Sentinel Mark VI (32106) — [star] Boost: If Targeted for Elimination is attached to an identity, deal this card to
  // that player as a facedown encounter card.
  "32106.boost": boost(ifThen(exists(MARKED_IDENTITY), dealAsEncounterCard(self, controllerOf(each(MARKED_IDENTITY))))),

  // Targeted for Elimination (32107) — Attach to your identity if a copy is not attached to you (data). Otherwise, this
  // card gains surge.
  "32107.targeted-for-elimination-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // While you are engaged with a Sentinel minion, you cannot change from hero form to alter-ego form.
  "32107.targeted-for-elimination-constant-2": constant(
    rule({
      kind: "cannotChangeForm",
      player: you,
      while: allOf(isHero(you), exists(query("minion", { trait: SENTINEL, engagedWithPlayer: you }))),
    }),
  ),
  // Action: Exhaust your identity → discard this card.
  "32107.targeted-for-elimination-action": action({ cost: exhaustYourHero }, discard(self)),

  // Relentless Robots (32108) — Each player engaged with a [Sentinel] minion cannot thwart this scheme.
  "32108.relentless-robots-constant": constant(
    cannotThwart(playersWhere(exists(query("minion", { trait: SENTINEL, engagedWithPlayer: thatPlayer }))), {
      schemes: query("sideScheme", { self: true }),
    }),
  ),
});
