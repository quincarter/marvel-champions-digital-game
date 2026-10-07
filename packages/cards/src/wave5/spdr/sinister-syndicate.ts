import { trait } from "@mc/content";
import {
  attachCard,
  boost,
  chooseCards,
  chosen,
  constant,
  countOf,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardEncounterCards,
  eachPlayer,
  exhaust,
  exists,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gets,
  heroAction,
  instead,
  not,
  putIntoPlay,
  query,
  rule,
  self,
  setDefeatDestination,
  spend,
  statOf,
  varOf,
  when,
  you,
  zone,
  after,
  defeatedWithExcessDamage,
  ifThen,
} from "../../dsl/index.js";

const CRIMINAL = trait("CRIMINAL");

/**
 * Iron Spider's Sinister Syndicate (`ironspider_sinister` `spdr` 31030–31037, docs/phase7-wave5-handoff.md): a
 * side scheme, six unique Criminal minions and the Surge in Crime environment. None of the six minions shares a
 * playable ability with cards printing the same title elsewhere in the corpus (`sm`'s Sinister Assault Bombshell
 * 27159/Electro 27159/Hobgoblin 27160, the `nova`-pack Bombshell 28002-adjacent and `ironheart`'s own Bombshell
 * 29033) — each is its own registry entry under its own `spdr` card id, never aliased by name.
 */
export const SPDR_SINISTER_SYNDICATE = defineAbilities({
  // Grand Larceny (31030, side scheme; startingThreat 4/0, 3 boost icons are data) — Threat cannot be removed
  // from this scheme while a Criminal minion is in play.
  "31030.grand-larceny-constant": constant(
    rule({
      kind: "threatCannotBeRemoved",
      target: { self: true },
      while: exists(query("minion", { trait: CRIMINAL })),
    }),
  ),

  // Bombshell (31031, minion; ATK 3/SCH 2/HP 4, CRIMINAL, unique) — [star] Divide damage from Bombshell's attack
  // among each character the attacked player controls as evenly as possible.
  //
  // `RuleSpec attacksDividedEvenly`: step 4's damage (after a hero defender's DEF) is split among the target player's
  // identity and allies, the first player placing any leftover points (RRG 1.8 "First Player", p. 19; the card names
  // nobody). Distinct from `divideBasicPower` (`wave5/ironheart/zzzax.ts`'s Bombshell 29033), a player command's.
  "31031.bombshell-constant": constant(rule({ kind: "attacksDividedEvenly", attacker: { self: true } })),

  // Bombshell (31031) — [star] Boost: Deal 1 indirect damage to each player. Exhaust each character damaged this
  // way.
  //
  // `dealIndirectDamage`'s `bind` slot `<bind>.damaged` holds each character that took at least 1 of the damage after
  // prevention (RRG 1.8 "Indirect Damage", p. 24), so a share a tough status card or a prevention stopped leaves its
  // character ready.
  "31031.boost": boost(dealIndirectDamage(eachPlayer, 1, { bind: "shock" }), exhaust(chosen("shock.damaged"))),

  // Electro (31032, minion; ATK 2/SCH 1/HP 3, CRIMINAL, unique) — [star] Electro gets +1 hit point for each
  // [energy] resource attached to her. `query("resource", …)` would mean the dedicated Resource card *type* (RRG
  // 1.8's own card type, distinct from "prints a resource icon" — `wave1/hlk/nemesis.ts`'s own "a [physical]
  // resource was discarded" reads that type), not what this card means: "a card attached to her with a printed
  // [energy] resource icon", any card type. Every card her own Forced Response attaches is always energy-typed
  // (below), so counting every attached card reads the same as counting only energy ones.
  "31032.electro-constant": constant(gets("hp", countOf(query([], { host: self })), query("minion", { self: true }))),
  // Electro (31032) — [star] Forced Response: After Electro engages you or activates against you, choose 1 card
  // from your hand with a printed [energy] resource and attach it to her. "Engages" is a separate event from an
  // activation (RRG 1.8 "Engage" p. 18 vs. "Activation" p. 6) — the same raw multi-kind pattern
  // `wave3/gmw/badoon.ts` Badoon Engineer (16065) and `wave5/sm/modulars/sinister-assault.ts` Electro (27159) both
  // use for "engages you or activates against you". A hand with no energy-resource card simply has no legal choice
  // (`chooseCards`'s own "min: 1, nothing eligible" handling) — the ability then does nothing, matching "choose …
  // and attach it" printing no fallback.
  "31032.electro-forced-response": forcedResponse(
    { on: ["minionEngaged", "enemyAttack", "enemyScheme"], selfIs: "source" },
    chooseCards("energy", zone("hand", you, { filter: { printedResource: "energy" } }), { min: 1, max: 1 }),
    attachCard(chosen("energy"), self),
  ),

  // Hobgoblin (31033, minion; ATK 2/SCH 2/HP 5, CRIMINAL, unique) — [star] Forced Interrupt: When Hobgoblin would
  // attack you, discard cards from the top of the encounter deck equal to Hobgoblin's ATK instead. Take 1
  // indirect damage for each boost icon discarded this way. The Crossbones' Machine Gun / Full Auto precedent
  // (`wave2/trors/crossbones.ts` 04064/04067) for "discard X cards equal to ATK, indirect damage per boost icon
  // discarded", wrapped in `instead(...)` on the attack itself (Risky Business's own "…instead" shape,
  // `wave1/gob/risky-business.ts`) since this replaces the attack rather than following it.
  "31033.hobgoblin-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("self", { againstYou: true }),
    { would: true },
    instead(discardEncounterCards(statOf(self, "atk"), { bind: "d" }), dealIndirectDamage(you, varOf("d.boostIcons"))),
  ),

  // Iron Spider (31034, minion; ATK 2/SCH 2/HP 6, CRIMINAL/ELITE, unique; Guard/Patrol/Retaliate 1/Toughness are
  // data) — [star] Iron Spider's attacks gain overkill, granted to the minion itself (the only place either
  // keyword is meaningful), the same read Karn's own "each Inheritor minion's attacks gain overkill and piercing"
  // (`wave5/spiderham/inheritors.ts` 30035) uses.
  "31034.iron-spider-constant": constant(gainsKeyword({ name: "overkill" }, query("minion", { self: true }))),

  // Sandman (31035, minion; ATK 1/SCH 1/HP 7, CRIMINAL, unique) — Forced Response: After Sandman takes any amount
  // of damage from an attack, discard the top 7 cards of the encounter deck.
  "31035.sandman-forced-response": forcedResponse(
    after.damage("self", { fromAttack: true, taken: true }),
    discardEncounterCards(7),
  ),
  // Sandman (31035) — [star] Boost: Discard the top 7 cards of the encounter deck.
  "31035.boost": boost(discardEncounterCards(7)),

  // Spot (31036, minion; ATK 1/SCH 1/HP 4, CRIMINAL, unique) — When Defeated: If Spot was defeated without excess
  // damage, shuffle him into the encounter deck. `defeatExcessDamage`/`defeatedWithExcessDamage` (spdr's own
  // 30021 "excess consequential damage" precedent, `dsl/values.ts`) reads the triggering defeat's own excess.
  // "When Defeated" is a Forced Interrupt (RRG 1.8 "When Defeated Abilities", p. 48; `resolve/defeated-
  // together.ts`'s own docblock step 3), so this is `forcedInterrupt(when.defeated(...))`, not the `whenDefeated`
  // ability-kind builder: `setDefeatDestination` only redirects a pending defeat's own leave destination if it
  // runs in that defeat event's own *interrupt* window — `beginDefeat` reads `event.destination` (set by
  // `setDefeatDestination` writing onto that same event frame) at the very top of the defeat's *apply* stage,
  // before the `whenDefeated` ability-kind's own frames are even pushed (`resolve/event.ts` `applyDefeat`/
  // `beginDefeat`), so a `whenDefeated`-kind ability is already too late to change it. `wave3/drax/drax-pack-
  // cards.ts`'s Regroup (`interrupt(when.defeated(...), setDefeatDestination(...))`) is the exact precedent.
  "31036.when-defeated": forcedInterrupt(
    when.defeated("self"),
    ifThen(not(defeatedWithExcessDamage), setDefeatDestination("encounterDeckShuffle")),
  ),
  // Spot (31036) — [star] Boost: Put this minion into play engaged with you (Badoon Grunt's own 16118 precedent).
  "31036.boost": boost(putIntoPlay(self, you)),

  // Surge in Crime (31037, environment; surge is data) — Each Criminal minion gains surge.
  "31037.surge-in-crime-constant": constant(gainsKeyword({ name: "surge" }, query("minion", { trait: CRIMINAL }))),
  // Surge in Crime (31037) — Hero Action: If there are no Criminal minions in play, spend 2 resources of any type
  // → discard this card.
  "31037.surge-in-crime-action": heroAction(
    { while: not(exists(query("minion", { trait: CRIMINAL }))), cost: spend(2) },
    discard(self),
  ),
});
