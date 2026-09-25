import { trait } from "@mc/content";
import {
  action,
  alterEgoAction,
  attachCard,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  coveredByEngineRule,
  defineAbilities,
  eachPlayer,
  exhaustThis,
  exhaustYourHero,
  heal,
  heroAction,
  heroResponse,
  interrupt,
  moveCards,
  on,
  ownerOf,
  playFromHandReducingCost,
  playableAttachments,
  preventDamage,
  putIntoPlay,
  query,
  ready,
  removeCounter,
  response,
  rule,
  self,
  spend,
  you,
  zone,
  attackingEnemy,
  dealDamage,
} from "../../dsl/index.js";

const ANDROID = trait("ANDROID");
const DEFENSE = trait("DEFENSE");
const AVENGER = trait("AVENGER");
const GUARDIAN = trait("GUARDIAN");

/**
 * Vision (`vision`) protection/basic/aggression/justice/leadership filler (26013–26024, 26033–26036, printed as a
 * generic aspect rather than `hero:26001a`). Reprints — Indomitable (26017), Side Step (26019), Get Behind Me!
 * (26020), Avengers Mansion (26023) — are exact Core/`qsv` cards, aliased automatically by `../reprints.ts`, not
 * scripted here.
 *
 * **Flow Like Water's "deal 1 damage to the attacking enemy" (26016.flow-like-water-response)** is `attackingEnemy`
 * (docs/phase7-wave4.md §3.34). **Defiance's "discard [a boost card] instead [of turning it faceup]"
 * (26018.defiance-interrupt) and Machine Man's "attacks or thwarts" (26022.machine-man-interrupt)** are documented at
 * each ref below.
 */
export const VISION_PACK_CARDS = defineAbilities({
  // Jocasta (ally, 26013) — You may play the event attached to Jocasta as if it were in your hand. Response: After
  // Jocasta enters play, choose a Defense event in your discard pile and attach it to her facedown.
  "26013.jocasta-constant": constant(playableAttachments(query("event", { host: self }))),
  "26013.jocasta-response": response(
    on.entersPlay("self"),
    chooseCards("found", zone("discard", you, { filter: query("event", { trait: DEFENSE }) }), { min: 0, max: 1 }),
    attachCard(chosen("found"), self, { facedown: true }),
  ),

  // Protector (ally, 26014) — Interrupt: When Protector would take any amount of damage, spend a [mental] resource
  // → reduce that amount by 1. (Limit once per round.)
  "26014.protector-interrupt": interrupt(
    on.damage("self"),
    { cost: spend({ mental: 1 }), limit: { count: 1, period: "round" } },
    preventDamage(1),
  ),

  // Victor Mancha (ally, 26015) — Reduce the amount of damage Victor Mancha takes from each attack by 1.
  "26015.victor-mancha-constant": constant(
    rule({ kind: "reduceDamageTaken", target: query("ally", { self: true }), amount: 1, fromAttack: true }),
  ),

  // Flow Like Water (upgrade, 26016) — Response: After you play a Defense card, deal 1 damage to the attacking enemy
  // (the attack in progress, `attackingEnemy`, docs/phase7-wave4.md §3.34; none outside an attack).
  "26016.flow-like-water-response": response(on.youPlayedCard({ trait: DEFENSE }), dealDamage(1, attackingEnemy)),

  // KNOWN_SKIPPED: 26018.defiance-interrupt — "Hero Interrupt (defense): When a boost card on an enemy attacking
  // you would be turned faceup, discard it instead." The trigger itself exists (`{ on: "boostCardTurnedFaceup",
  // playerIs: "controller", eventIs: { activation: "attack" } }`, `packages/engine/src/trigger-events.ts`), but the
  // only effect that intercepts it, `cancelBoostIcons` (`packages/engine/src/spec.ts`), zeroes the card's icons —
  // it still turns faceup and joins the boost pool, rather than being discarded outright and never counted at all,
  // which is what "discard it instead" (of turning faceup) means. See `KNOWN_SKIPPED["vision"]` in
  // `../coverage.test.ts`.

  // Preservation (resource, 26021) — Max 1 per deck (data). Hero Response: After you spend this card, heal 1
  // damage from your hero.
  "26021.preservation-response": heroResponse(on.youSpendThis(), heal(1, self)),

  // KNOWN_SKIPPED: 26022.machine-man-interrupt — "Interrupt: When Machine Man attacks or thwarts, spend up to 3
  // resources of any type → Machine Man gets +1 THW and +1 ATK for this use for each resource spent this way." The
  // engine's `EventPattern.eventIs` (`packages/engine/src/resolve/triggers.ts`) matches one exact value per key, no
  // set — `basicPowerUsing`'s own `power` field is a single "attack" | "thwart" | "defense" | "recover", so there is
  // no way to match "attack or thwart" while excluding "defense" in one trigger. Omitting the filter entirely (any
  // basic power) would let this ability also fire on Machine Man's own defense, buffing his DEF with
  // `modifyBasicPower` — a real over-trigger the printed card does not grant. See `KNOWN_SKIPPED["vision"]` in
  // `../coverage.test.ts`.

  // Avengers Mansion is a reprint (26023, module docblock).

  // Reboot (event, 26024) — Action: Ready a friendly Android character and heal 1 damage from it.
  "26024.reboot-action": action(
    chooseTarget("android", query(["identity", "ally"], { trait: ANDROID })),
    ready(chosen("android")),
    heal(1, chosen("android")),
  ),

  // Assault Training (support, 26033) — Max 2 per deck. Uses (2 training counters) (data). Alter-Ego Action:
  // Exhaust this card and remove 1 training counter from it → choose an Aggression (red) event in your discard
  // pile and shuffle it into your deck.
  "26033.assault-training-action": alterEgoAction(
    { cost: [exhaustThis, removeCounter("training", 1)] },
    chooseCards("found", zone("discard", you, { filter: query("event", { aspect: "aggression" }) }), {
      min: 0,
      max: 1,
    }),
    moveCards(cards(chosen("found")), "deckShuffle"),
  ),

  // Chance Encounter (upgrade, 26034) — Attach to a side scheme. Max 1 per scheme (data). Interrupt: When attached
  // side scheme is defeated, search your deck and discard pile for an ally and add it to your hand. Shuffle your
  // deck.
  "26034.chance-encounter-constant": coveredByEngineRule(),
  // KNOWN_SKIPPED: 26034.chance-encounter-interrupt. `schemeDefeated` isn't in `isAnnouncement`'s explicit
  // interruptible list (`packages/engine/src/trigger-events.ts`), so — same substitution `wave2/trors/red-skull.ts`'s
  // own Twisted Reality (04135) documents for the identical "[Forced] Interrupt: when attached side scheme is
  // defeated" wording — it can only be scripted as a `response`. But unlike Twisted Reality (whose ability lives on
  // the *side scheme itself*), Chance Encounter's ability lives on the *attachment*, and RRG 1.8 "Flip"/discard rules
  // remove a defeated scheme's attachments as part of the same cleanup that announces `schemeDefeated` — confirmed
  // with `traceAbilities` (`packages/cards/src/testing/trace.ts`): the ability is `considered` (looked up while
  // Chance Encounter is still in play, before the thwart resolves) but never `resolved`, because by the time the
  // response window opens the attachment is already gone. `characterDefeated` has a documented escape hatch for
  // exactly this shape (`EventPattern.targetHadAttachment`, "a card matching this was attached when the defeat was
  // initiated, read after the character left play" — Flight of the Valkyrior, Valhalla, docs/phase7-wave4.md §3.22);
  // `schemeDefeated` has no equivalent, so there is no way to read "the ally search Chance Encounter itself printed"
  // once its own host scheme is gone. See `KNOWN_SKIPPED["vision"]` in `../coverage.test.ts`.

  // Joining Forces (event, 26035) — Alliance (data). Hero Action: As a group, the players put a total of 1 Avenger
  // ally and 1 Guardian ally into play from their hand(s). `zone("hand", eachPlayer, …)` pools every player's hand
  // into one search (`packages/engine/src/resolve/cards.ts`'s own `case "zone"` loops `resolvePlayers` over the
  // selector's player, which `eachPlayer` — `PlayerRef { kind: "each" }` — resolves to every seat); `excluding:
  // chosen("avenger")` on the second pick keeps one card from paying both roles, the same "no card pays two slots"
  // reading `exhaustEachCost` already established for Alliance costs (docs/phase7-wave4.md §3.17) — here for an
  // effect rather than a cost, per that section's own "to be confirmed [in scripting]" note. Each ally enters play
  // under whichever player's hand it came from (`ownerOf`), not necessarily the card's own player.
  "26035.joining-forces-action": heroAction(
    chooseCards("avenger", zone("hand", eachPlayer, { filter: query("ally", { trait: AVENGER }) }), {
      min: 1,
      max: 1,
    }),
    putIntoPlay(chosen("avenger"), ownerOf(chosen("avenger"))),
    chooseCards(
      "guardian",
      zone("hand", eachPlayer, { filter: query("ally", { trait: GUARDIAN, excluding: chosen("avenger") }) }),
      { min: 1, max: 1 },
    ),
    putIntoPlay(chosen("guardian"), ownerOf(chosen("guardian"))),
  ),

  // Meditation (event, 26036) — Alter-Ego Action: Exhaust your alter-ego → play a card from your hand, reducing its
  // resource cost by 3.
  "26036.meditation-action": alterEgoAction({ cost: exhaustYourHero }, playFromHandReducingCost(3)),
});
