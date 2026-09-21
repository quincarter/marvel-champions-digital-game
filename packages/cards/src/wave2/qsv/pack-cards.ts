import { trait } from "@mc/content";
import {
  action,
  atEndOfAttack,
  attacksGainKeywords,
  cancelWhenRevealed,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  discardThis,
  eventDealt,
  eventSource,
  exhaustThis,
  FRIENDLY_CHARACTER,
  forcedResponse,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  ifThen,
  modifyStat,
  not,
  on,
  paidWith,
  preventDamage,
  putIntoPlay,
  query,
  resource,
  response,
  scaled,
  self,
  shuffleDeck,
  spend,
  stun,
  theVillain,
  villainStageNumberOf,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

const DEFENSE = trait("DEFENSE");
const THWART = trait("THWART");

/**
 * The `qsv` pack's non-hero-specific player cards (docs/phase7-wave1-scripting.md §1's convention): Protection
 * (14012–14017), Basic (14018, 14022, 14023, 14032), Aggression (14029), Justice (14030), Leadership (14031).
 * Armored Vest (14016) and the three basic resources (14019–14021) are verbatim Core reprints, aliased by
 * `../reprints.ts`, not scripted here.
 *
 * **Multiple Man's "search your deck and hand … shuffle your deck if it was searched this way" (14012) always
 * shuffles**, not only when a copy is actually found there: RRG 1.8 "Search" (p. 39), "If any portion of a deck is
 * searched … shuffle that entire deck" — the deck is always part of the pool searched (deck **and** hand), so it
 * is always shuffled, the same reading `searchAndReveal` (`dsl/effects.ts`) already established for an encounter
 * deck search that comes up empty.
 *
 * **Never Back Down's "if you take no damage from this attack, stun the attacking enemy" (14014) is a single Hero
 * Interrupt, not two abilities**: the `+2 DEF` applies immediately (before damage is calculated), and the stun is
 * queued with `atEndOfAttack`, resolving once the attack's final results are known — the same "defer a conditional
 * half of one Interrupt to the attack's own end" shape Sweeping Swoop's boost (01168, `core/heroes/spider-man.ts`)
 * already uses, reading `eventDealt`/`not(eventDealt(...))` off the now-finished `enemyAttack` event
 * (`currentActivationFrameId`, confirmed by `resolve/event.ts`'s own "`const event = withResults(frame.event,
 * frame.vars)`" for a deferred end-of-attack effect).
 *
 * **Vibration Resistance's "reduce the damage attached enemy takes from each attack by 1" (14027, nemesis) is a
 * Forced Interrupt + `preventDamage`, not a new `RuleSpec`**: RRG 1.8 "Prevent" (p. 34), "the damage is dealt but
 * not taken" for the prevented amount — mechanically identical to a flat reduction, and there is no card in the
 * pool (or precedent elsewhere) needing the two to behave differently, so no new primitive was requested for it.
 */
export const QSV_PACK_CARDS = defineAbilities({
  // Multiple Man (14012, Protection ally) — Response: after Multiple Man enters play, search your deck and hand
  // for a copy and put it into play. Shuffle your deck (module docblock — always, per RRG "Search").
  "14012.multiple-man-response": response(
    on.entersPlay("self"),
    chooseCards("found", zone(["deck", "hand"], you, { filter: { name: cardName("14012") } }), { min: 0, max: 1 }),
    putIntoPlay(chosen("found"), you),
    shuffleDeck(),
  ),

  // Warlock (14013, Protection ally) — Action: Spend a [mental] resource → heal up to 2 damage from Warlock (a
  // heal effect can never exceed the damage present, RRG 1.8 "Heal", p. 22, so "up to 2" is just `heal(2, self)`).
  "14013.warlock-action": action({ cost: spend({ mental: 1 }) }, heal(2, self)),

  // Never Back Down (14014, Protection event) — Hero Interrupt (defense): when you defend against an attack, you
  // get +2 DEF for this attack. If you take no damage from this attack, stun the attacking enemy (module
  // docblock).
  "14014.never-back-down-interrupt": heroInterrupt(
    on.defends(YOUR_IDENTITY),
    { label: "defense" },
    modifyStat("def", 2, yourIdentity, "endOfAttack"),
    atEndOfAttack(ifThen(not(eventDealt("damage")), stun(eventSource))),
  ),

  // Side Step (14015, Protection event) — Hero Interrupt (defense): when you would take any amount of damage,
  // prevent 3 of that damage. If you paid for this card using [energy], deal 1 damage to that enemy.
  "14015.side-step-interrupt": heroInterrupt(
    on.damage(YOUR_IDENTITY),
    { label: "defense" },
    preventDamage(3),
    ifThen(paidWith("energy"), dealDamage(1, eventSource)),
  ),

  // Armored Vest (14016) is a verbatim Core reprint, aliased by `../reprints.ts` — not scripted here.

  // Nerves of Steel (14017, Protection upgrade) — Play under any player's control. Max 1 per player (data).
  // Resource: Exhaust Nerves of Steel → generate a [energy] resource for a Defense event.
  "14017.nerves-of-steel-resource": resource(
    { energy: 1 },
    { cost: exhaustThis, generatesFor: query("event", { trait: DEFENSE }) },
  ),

  // Order and Chaos (14018, Basic event) — Team-Up (Quicksilver and Scarlet Witch), Max 1 per deck (data). Hero
  // Interrupt: when a treachery card is revealed from the encounter deck, cancel its "When Revealed" effects, then
  // deal 2 damage to the villain.
  "14018.order-and-chaos-interrupt": heroInterrupt(
    on.encounterCardRevealed(query("treachery")),
    cancelWhenRevealed(),
    dealDamage(2, theVillain),
  ),

  // Adrenaline Rush (14022, Basic upgrade) — Hero Action: Discard Adrenaline Rush → your hero gets +1 ATK until
  // the end of the phase.
  "14022.adrenaline-rush-action": heroAction({ cost: discardThis }, modifyStat("atk", 1, yourIdentity, "endOfPhase")),

  // Civic Duty (14023, Basic upgrade) — Hero Action: Discard Civic Duty → your hero gets +1 THW until the end of
  // the phase.
  "14023.civic-duty-action": heroAction({ cost: discardThis }, modifyStat("thw", 1, yourIdentity, "endOfPhase")),

  // Brute Force (14029, Aggression upgrade) — Your hero gets +1 ATK. Your basic attacks gain piercing. Forced
  // Response: after you make a basic attack, discard Brute Force.
  "14029.brute-force-constant": constant(
    gets("atk", 1, YOUR_IDENTITY),
    attacksGainKeywords(["piercing"], { attacker: YOUR_IDENTITY, basicOnly: true }),
  ),
  "14029.brute-force-forced-response": forcedResponse(on.attacks(YOUR_IDENTITY, { basic: true }), discard(self)),

  // Sense of Justice (14030, Justice upgrade) — Play under any player's control. Max 1 per player (data).
  // Resource: Exhaust Sense of Justice → generate a [mental] resource for a Thwart event.
  "14030.sense-of-justice-resource": resource(
    { mental: 1 },
    { cost: exhaustThis, generatesFor: query("event", { trait: THWART }) },
  ),

  // United We Stand (14031, Leadership event) — Play only if your identity has the Avenger trait (data). Hero
  // Action: Heal 1 damage from up to X friendly characters (to a maximum of 3), where X is the villain's stage
  // number (`villainStageNumberOf`, docs/phase7-wave2.md; the same reading Running Interference, `wsp/pack-
  // cards.ts`, already uses for the identical "X is the villain's stage number" phrase).
  "14031.united-we-stand-action": heroAction(
    chooseTarget("healed", FRIENDLY_CHARACTER, { optional: true, count: scaled(villainStageNumberOf(), { max: 3 }) }),
    heal(1, chosen("healed")),
  ),

  // Beat 'Em Up (14032, Basic event) — Hero Action: Deal 1 damage to the villain and each minion engaged with you.
  "14032.beat-em-up-action": heroAction(
    dealDamage(1, theVillain),
    dealDamage(1, { kind: "each", query: query("minion", { engagedWith: "you" }) }),
  ),
});
