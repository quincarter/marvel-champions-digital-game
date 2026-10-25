import { trait } from "@mc/content";
import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  action,
  allOf,
  anyOf,
  attacksGainKeywords,
  cards,
  chooseCards,
  chooseOne,
  chosen,
  constant,
  declareDefender,
  defineAbilities,
  heroResponse,
  undefendedAttack,
  eventPlayer,
  exhaustThis,
  handCountOf,
  hasStatus,
  identityOf,
  modifyStat,
  on,
  option,
  playTuckedCard,
  query,
  removeStatus,
  response,
  self,
  tuckCards,
  tuckedCount,
  valueAtLeast,
  valueEquals,
  zone,
  you,
} from "../../dsl/index.js";

/**
 * Wave 10 scripting module `wonder_man/basic` (docs/phase7-wave10-hero-packs.md H8.4, HS7).
 *
 * Cards (4):
 * - 58022 Swordsman (ally)
 * - 58023 Energy (resource; prints no ability, a reprint of 01088)
 * - 58024 Jarvis (support)
 * - 58034 Avengers Compound (support)
 *
 * No ruling in docs/rulings/marvel-champions-rulings-post-rrg-1-7.md names these cards.
 *
 * **58022.swordsman-constant**: "Swordsman's basic attacks gain piercing." A grant to attacks made by him and only by
 * him (`attacker: self`, `basicOnly`): the keyword belongs to the attack, not to Swordsman as a character (RRG 1.8
 * "Piercing", p. 33), and an attack made by an event he is named in does not gain it.
 *
 * **58022.swordsman-response**: "Hero Response: After a boost card is turned faceup during an undefended attack,
 * declare Swordsman as the defender without exhausting him." Heard on `boostCardTurnedFaceup` of a villain's attack
 * on ANY player (the print says "an undefended attack", not "against you"; no `playerIs`; a raw pattern, as Preemptive
 * Strike 05014 does). Taken for another player's attack, Swordsman becomes the defender and his controller the target
 * player (RRG 1.8 "Attack (Enemy Activation)", pp. 8-9; "Defend, Defense", p. 15), `while undefendedAttack`; `declareDefender`
 * without `exhaust` is the "without exhausting him", usable on an exhausted ally (RRG 1.8 "Defend, Defense", p. 15).
 * The engine already declares the defender after the boost step opens, so spec task HT17 (H3.20) is not needed: he
 * becomes the attack's target and takes its damage including the boost icons, the hero none. Optional, a Hero
 * Response (alter-ego form: not offered), and not offered once anyone defends.
 *
 * **58024.jarvis-response**: "Response: After an Avenger hero changes into alter-ego form, exhaust Jarvis -> choose:
 * +2 REC until the end of the phase, or discard a status card." "An Avenger hero" is the identity's hero face, read as
 * the face it just left (`fromTrait`, as Moira MacTaggert 38018 does), of any player, not only Jarvis's controller.
 * "That identity" is the identity of the player who changed (`eventPlayer`). The discard option is offered only to an
 * identity holding a status card (the choice of which is the player's: one option per status), as Godlike Stamina
 * (25024) does; the +2 REC is always available.
 *
 * **58034.avengers-compound-action**: "Play only if your identity has the Avenger trait" is printed data
 * (`playRestrictions`). "Action: Exhaust Avengers Compound -> choose: tuck 1 ally from your hand here if there is no
 * ally tucked here, or play the ally tucked here as if it were in your hand." Each option is offered only when it can
 * be done (a hand ally and nothing tucked; something tucked), and the ability is not initiated when neither can
 * (RRG 1.8 "Choose (Option)", p. 12: a choice must be of options that can be done). The tucked ally is played at its cost, with every play
 * restriction applying, as Med Lab (38028) plays its own (RRG 1.8 "Tuck", p. 45).
 */
const AVENGER = trait("Avenger");
const STATUSES = ["stunned", "confused", "tough"] as const;
const THAT_IDENTITY = identityOf(eventPlayer);

/** "After a boost card is turned faceup during an undefended attack": no sugar in `on`/`when`, so a raw pattern (as Preemptive Strike 05014). */
const DURING_AN_UNDEFENDED_ATTACK: EventPattern = {
  on: "boostCardTurnedFaceup",
  sourceIs: { categories: ["villain"] },
  activation: "attack",
};

export const WONDER_MAN_BASIC: AbilityRegistry = defineAbilities({
  "58022.swordsman-constant": constant(
    attacksGainKeywords(["piercing"], { attacker: { self: true }, basicOnly: true }),
  ),

  "58022.swordsman-response": heroResponse(
    DURING_AN_UNDEFENDED_ATTACK,
    { while: undefendedAttack },
    declareDefender(self),
  ),

  "58024.jarvis-response": response(
    on.playerChangesForm("alterEgo", { fromTrait: AVENGER }),
    { cost: exhaustThis },
    chooseOne(
      option("That identity gets +2 REC until the end of the phase", modifyStat("rec", 2, THAT_IDENTITY, "endOfPhase")),
      ...STATUSES.map((status) =>
        option(
          `Discard the ${status} status card from that identity`,
          { when: hasStatus(THAT_IDENTITY, status) },
          removeStatus(THAT_IDENTITY, status, { count: 1 }),
        ),
      ),
    ),
  ),

  "58034.avengers-compound-action": action(
    {
      cost: exhaustThis,
      // Not initiated while neither option could be done (nothing tucked and no ally in hand): no wasted exhaust.
      while: anyOf(valueAtLeast(tuckedCount(), 1), valueAtLeast(handCountOf(you, query("ally")), 1)),
    },
    chooseOne(
      option(
        "Tuck an ally from your hand here",
        { when: allOf(valueEquals(tuckedCount(), 0), valueAtLeast(handCountOf(you, query("ally")), 1)) },
        chooseCards("ally", zone("hand", you, { filter: query("ally") }), { min: 1, max: 1 }),
        tuckCards(cards(chosen("ally")), self),
      ),
      option("Play the tucked ally", { when: valueAtLeast(tuckedCount(), 1) }, playTuckedCard()),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const WONDER_MAN_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
