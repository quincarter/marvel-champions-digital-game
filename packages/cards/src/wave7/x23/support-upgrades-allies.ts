import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  after,
  andThen,
  attacksGainKeywords,
  bindTargets,
  cards,
  chooseCards,
  chooseOne,
  chosen,
  constant,
  countersOn,
  dealDamage,
  defineAbilities,
  discard,
  discardFromHandCost,
  each,
  exhaustThis,
  forcedResponse,
  gainsKeyword,
  gets,
  heal,
  heroAction,
  heroResponse,
  host,
  ifThen,
  isHero,
  modifyAttack,
  modifyStat,
  moveCards,
  not,
  on,
  option,
  printedHpOf,
  query,
  ready,
  refMatches,
  remainingHpOf,
  resource,
  response,
  scaled,
  self,
  setVar,
  shuffleDeck,
  takeDamageCost,
  topOfDeck,
  totalPrintedResources,
  valueAtLeast,
  varOf,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
  you,
  eventTarget,
  interrupt,
  engage,
} from "../../dsl/index.js";
import { MSM_PACK_CARDS } from "../../wave1/msm/pack-cards.js";
import { PSYLOCKE_SUPPORT_UPGRADES_ALLIES } from "../psylocke/support-upgrades-allies.js";

/** The upgrade's host: its player's identity (an upgrade with no "attach to" text goes to it). */
const HOST = { hostOfSelf: true } as const;
const HONEY_BADGER = query("ally", { name: "Honey Badger" });
/** "Remaining hit points are less than half the starting hit points": twice the remaining is below the printed. */
const HALF = not(valueAtLeast(scaled(remainingHpOf(host), { times: 2 }), printedHpOf(host)));

/**
 * X-23's permanent Claws, allies, supports and upgrades (43002-43027), docs/phase7-wave7.md §7.3, §3.85.
 *
 * - **X-23's Claws (43002)**: Permanent is data. The cost is exhausting the card and taking 2 damage (RRG "Cost", p. 14:
 *   not paid unless all of it is taken), so Living Weapon answers the damage as a cost.
 * - **Honey Badger (43003)**: she is gone by the time her own response would trigger when the damage defeated her
 *   (RRG "Damage" step 8 before step 9; FAQ p. 64), so `taken: true` offers it only when she survives.
 * - **Sisterhood (43008)**: the discarded card may be Honey Badger herself, who is then found in the discard pile.
 *   Finding her is optional (a search); the deck is shuffled either way.
 * - **Adamantium Lacing (43009)**: "X-23 gains retaliate 1" is the hero face's (`isHero`).
 * - **Puncture Wound (43012)**: the host is bound before the card is discarded, then dealt the damage.
 * - **Boom Boom (43013)**: the counters are recorded before she is discarded for the damage.
 * - **Rictor (43014)**: "each resource on the discarded card" is the printed resource icons, counted as the hero
 *   face counts discarded icons (docs/phase7-wave7.md §3.56).
 * - **Shatterstar (43015)**: "already engaged" is read before he engages the minion.
 * - **"Now I'm Mad" (43019)**: "less than half" is twice the remaining hit points below the printed hit points.
 * - **The Direct Approach (43020)**: "Limit 1 per side scheme" is `playRestrictions.maxPerHost` in the data (the
 *   parser reads "Limit" as it reads "Max"), so only the assault gain is scripted.
 * - **IPAC (43025), X-Bunker (43026), Endurance (43027)**: reprints of 41022, 41023 and 36026 (05023), aliased.
 */
export const X23_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "43002.x-23s-claws-action": heroAction(
    { cost: [exhaustThis, takeDamageCost(2)] },
    modifyStat("atk", 2, yourIdentity, "endOfRound"),
  ),

  "43003.honey-badger-response": heroResponse(on.damage("self", { taken: true }), ready(yourIdentity)),

  "43008.sisterhood-action": action(
    { cost: [exhaustThis, discardFromHandCost(1, 1, undefined, { identitySetOf: you })] },
    chooseCards("found", zone(["deck", "discard"], you, { filter: HONEY_BADGER }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  "43009.adamantium-lacing-constant": constant(gets("hp", 2, YOUR_IDENTITY)),
  "43009.adamantium-lacing-constant-2": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, HOST, { while: isHero() }),
    attacksGainKeywords(["piercing"], { attacker: HOST, basicOnly: true }),
  ),

  "43010.grim-resolve-resource": resource({ wild: 1 }, { cost: [exhaustThis, takeDamageCost(1)] }),

  "43011.pain-tolerance-response": response(after.youPlayedCard({ identitySetOf: you }), heal(1, yourIdentity)),

  "43012.puncture-wound-constant": constant(gets("atk", -1, HOST)),
  "43012.puncture-wound-forced-response": forcedResponse(
    on.phaseBeginning("player"),
    bindTargets("enemy", host),
    discard(self),
    dealDamage(3, chosen("enemy")),
  ),

  "43013.boom-boom-action": action(
    { cost: exhaustThis },
    addCounters("boom", 1, self),
    andThen(
      chooseOne(
        option(
          "Discard Boom Boom to deal damage",
          setVar("booms", countersOn(self, "boom")),
          discard(self),
          dealDamage(varOf("booms"), each(query("enemy"))),
        ),
        option("Keep Boom Boom"),
      ),
    ),
  ),

  "43014.rictor-response": response(
    after.attacks("self"),
    moveCards(topOfDeck(1), "discard", "milled"),
    dealDamage(totalPrintedResources(chosen("milled")), each(query("minion", { engagedWith: "you" }))),
  ),

  "43015.shatterstar-interrupt": interrupt(
    on.attacks("self", { target: query("minion") }),
    ifThen(refMatches(eventTarget, query("minion", { engagedWith: "you" })), modifyAttack({ atkBonus: 1 })),
    engage(eventTarget),
  ),

  "43019.now-im-mad-constant": constant(gets("atk", 1, HOST, { while: HALF }), gets("thw", -1, HOST, { while: HALF })),

  "43020.the-direct-approach-constant": constant(gainsKeyword({ name: "assault" }, HOST)),

  "43025.ipac-action": PSYLOCKE_SUPPORT_UPGRADES_ALLIES["41022.ipac-action"]!,
  "43026.x-bunker-action": PSYLOCKE_SUPPORT_UPGRADES_ALLIES["41023.x-bunker-action"]!,
  "43027.endurance-constant": MSM_PACK_CARDS["05023.endurance-constant"]!,
});
