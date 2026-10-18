import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  alterEgoAction,
  anAttackableEnemy,
  attack,
  chooseOne,
  chosen,
  constant,
  countersOn,
  defeatingPlayer,
  defineAbilities,
  discardEncounterCards,
  draw,
  excludedFromPlayerSideSchemeLimit,
  heroAction,
  ifThen,
  moveCards,
  named,
  on,
  option,
  query,
  refMatches,
  ready,
  removeCountersFrom,
  response,
  revealCard,
  self,
  thwartAScheme,
  valueAtLeast,
  whenDefeated,
  yourIdentity,
  you,
} from "../../../dsl/index.js";

const EVIDENCE = "evidence";
const ALIAS = named("Alias Investigations");
const ALIAS_QUERY = query("support", { name: "Alias Investigations", controller: "you" });
const HAS_EVIDENCE = valueAtLeast(countersOn(ALIAS, EVIDENCE), 1);

/**
 * Wave 11 scripting module `jj/jessica-jones/events` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (4):
 * - 61004 "Big Mistake" (event)
 * - 61005 Breakthrough (event)
 * - 61006 Snooping Around (event)
 * - 61007 Piecing It All Together (player_side_scheme)
 *
 * **61004**: the optional removal comes before the attack and fixes its amount (3, or 3 + 2 = 5) and keyword
 * (overkill or piercing, the player's pick); an option is offered only while Alias Investigations holds an evidence

 * counter. The "+2 additional damage" is folded into the attack amount on purpose instead of the spec's
 * `modifyAttack({ extraDamage })`: that grant is untested inside an event's own (attack) effect, and the result is the
 * same (one attack of 5 damage, RRG 1.8 p. 10). **61005**: one answer per placement (`eventAmount` is not read); the event shuffles itself into the deck.
 * **61006**: the discarded card is revealed from the discard pile (RRG 1.8 "Reveal", p. 38). **61007**: the limit
 * exemption is a per-card constant (docs/phase7-wave11-hero-packs.md H3.22).
 */
export const JJ_JESSICA_JONES_EVENTS: AbilityRegistry = defineAbilities({
  "61004.big-mistake-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    chooseOne(
      option(
        "Remove 1 evidence counter: 2 additional damage and overkill",
        { when: HAS_EVIDENCE },
        removeCountersFrom(ALIAS, EVIDENCE, 1),
        attack(5, chosen("enemy"), { overkill: true }),
      ),
      option(
        "Remove 1 evidence counter: 2 additional damage and piercing",
        { when: HAS_EVIDENCE },
        removeCountersFrom(ALIAS, EVIDENCE, 1),
        attack(5, chosen("enemy"), { keywords: ["piercing"] }),
      ),
      option("Do not remove an evidence counter", attack(3, chosen("enemy"))),
    ),
  ),

  "61005.breakthrough-response": response(
    on.countersPlaced(EVIDENCE, ALIAS_QUERY),
    ready(yourIdentity),
    moveCards({ kind: "ref", ref: self }, "deckShuffle"),
  ),

  "61006.snooping-around-action": alterEgoAction(
    { label: "thwart" },
    ...thwartAScheme(4),
    addCounters(EVIDENCE, 2, ALIAS),
    discardEncounterCards(1, {
      forEachDiscarded: {
        slot: "snooped",
        effects: [
          ifThen(
            refMatches(chosen("snooped"), query(["minion", "sideScheme"]), { anywhere: true }),
            revealCard(chosen("snooped"), you),
          ),
        ],
      },
    }),
  ),

  "61007.piecing-it-all-together-constant": constant(excludedFromPlayerSideSchemeLimit({ self: true })),
  "61007.when-defeated": whenDefeated(draw(3, defeatingPlayer)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const JJ_JESSICA_JONES_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
