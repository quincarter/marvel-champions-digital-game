import { trait } from "@mc/content";
import {
  action,
  addCounters,
  after,
  alterEgoAction,
  attackAnEnemy,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  discardThis,
  doublesResourcesWhilePayingFor,
  draw,
  each,
  encounterCards,
  exhaustEachCost,
  exhaustThis,
  exhaustYourHero,
  exists,
  forcedResponse,
  giveTough,
  gets,
  hasStatus,
  heal,
  heroAction,
  heroInterrupt,
  ifThen,
  interrupt,
  modifyAttack,
  moveCards,
  not,
  on,
  option,
  playFromHandReducingCost,
  putIntoPlay,
  query,
  ready,
  refMatches,
  removeCounter,
  removeStatus,
  resolveAttackAgainst,
  response,
  self,
  shuffleDeck,
  shuffleEncounterDeck,
  spend,
  statOf,
  sum,
  theVillain,
  thwart,
  yourIdentity,
  you,
  zone,
} from "../../dsl/index.js";

const AVENGER = trait("AVENGER");
const GUARDIAN = trait("GUARDIAN");
const ASGARD = trait("ASGARD");
const YOUR_HERO = query("hero", { controller: "you" });
const YOUR_IDENTITY = query("identity", { controller: "you" });

/**
 * Valkyrie's Aggression aspect and basic cards (25013–25024), and the Justice/Leadership/Protection/Basic
 * starter-deck cards printed under her own heading (25033–25036). The two Basic resources with no ability (Energy,
 * Genius, Strength, 25025–25027) carry no `abilities` entry, so nothing to script for them.
 */
export const VALKYRIE_PACK_CARDS = defineAbilities({
  // Thor (ally, 25013) — Toughness (data). Interrupt: When Thor attacks a minion engaged with a player, spend a
  // [energy] resource → resolve this attack against each minion engaged with that player (in the order of your
  // choice). Reused verbatim from `packages/engine/src/valkyrie-kit.test.ts`'s own THOR_INTERRUPT fixture.
  "25013.thor-interrupt": interrupt(
    on.attacks("self", { target: query("minion", { engagedWith: "you" }) }),
    { cost: spend({ energy: 1 }) },
    resolveAttackAgainst(each(query("minion", { engagedWith: "you" }))),
  ),

  // Throg (ally, 25014) — Response: After Throg enters play, give him a tough status card if you are engaged with a
  // minion.
  "25014.throg-response": response(
    on.entersPlay("self"),
    ifThen(exists(query("minion", { engagedWith: "you" })), giveTough(self)),
  ),

  // Angela (ally, 25015, same card as `gam` 18011) — Forced Response: After Angela enters play under your control,
  // search the top 10 cards of the encounter deck for a minion and put it into play engaged with you. Shuffle the
  // encounter deck. If a minion was not put into play this way, discard Angela. Copied verbatim from `wave3/gam/
  // gamora-kit.ts`'s own "18011.angela-forced-response" under this pack's own ability id.
  "25015.angela-forced-response": forcedResponse(
    after.entersPlay("self"),
    chooseCards("found", encounterCards(["deck"], query("minion"), 10), { min: 0, max: 1 }),
    putIntoPlay(chosen("found"), you),
    shuffleEncounterDeck(),
    ifThen(not(refMatches(chosen("found"), query("minion"))), discard(self)),
  ),

  // Hall of Heroes (support, 25016, reprints `thor` 06017) — Response: After you defeat a minion, place 1 glory
  // counter here. Alter-Ego Action: Exhaust Hall of Heroes and remove 3 glory counters from it → draw 3 cards.
  "25016.hall-of-heroes-response": response(after.defeated(query("minion"), { byYou: true }), addCounters("glory", 1)),
  "25016.hall-of-heroes-action": alterEgoAction({ cost: [exhaustThis, removeCounter("glory", 3)] }, draw(3)),

  // Combat Training (upgrade x2, 25017, reprints Core's own 01057) — Play under any player's control. Max 1 per
  // player (data). Your hero gets +1 ATK.
  "25017.combat-training-constant": constant(gets("atk", 1, YOUR_HERO)),

  // Quick Strike (event x3, 25018) — Hero Action (attack): Deal damage to an enemy equal to your ATK. The "Crushing
  // Blow" shape (`wave1/hlk/kit.ts` 10002).
  "25018.quick-strike-action": heroAction({ label: "attack" }, attackAnEnemy(statOf(yourIdentity, "atk"))),

  // Smash the Problem (event x3, 25019) — Hero Action (thwart): Exhaust your hero → remove threat from a scheme
  // equal to your hero's ATK. The "Intimidation" shape (`wave3/drax/drax-kit.ts` 19004), reading ATK instead of THW.
  "25019.smash-the-problem-action": heroAction(
    { label: "thwart", cost: exhaustYourHero },
    chooseTarget("scheme", query("scheme")),
    thwart(statOf(yourIdentity, "atk"), chosen("scheme")),
  ),

  // The Best Defense… (event x3, 25020) — Hero Interrupt (defense): When your hero defends against an attack, use
  // its ATK instead of its DEF for this attack.
  "25020.the-best-defense-interrupt": heroInterrupt(
    on.basicPowerUsing(YOUR_IDENTITY, { power: "defense" }),
    { label: "defense" },
    modifyAttack({ defenseUsesAtk: true }),
  ),

  // Audacity (resource, 25021) — Max 1 per deck (data). Hero Response: After you spend this card, deal 1 damage to
  // the villain.
  "25021.audacity-response": response(on.youSpendThis(), dealDamage(1, theVillain)),

  // The Power of Aggression (resource x2, 25022, reprints Core's own 01055) — Max 2 per deck (data). Double the
  // number of resources this card generates while paying for an Aggression (red) card.
  "25022.the-power-of-aggression-constant": constant(doublesResourcesWhilePayingFor({ aspect: "aggression" })),

  // The Bifrost (support, 25023) — Play only if your identity has the asgard trait (data). Action: Exhaust The
  // Bifrost → search your deck for an asgard ally and play it (paying its cost). Shuffle your deck. The engine has
  // no "play a card straight from the deck" effect (`playFromHand` only reads "hand"/"setAside"), so the found ally
  // is moved to hand first, then played there reducing its cost by 0 (its full printed cost is still paid) —
  // behaviorally the same "play it (paying its cost)" for the one asgard ally this search can put in hand at a time
  // (every asgard ally in this pack — Thor, Throg, Angela — is unique, so it is also the only match when it's played).
  "25023.the-bifrost-action": action(
    { cost: exhaustThis },
    chooseCards("found", zone("deck", you, { filter: query("ally", { trait: ASGARD }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    playFromHandReducingCost(0, you, { filter: query("ally", { trait: ASGARD }) }),
    shuffleDeck(),
  ),

  // Godlike Stamina (event x3, 25024) — Play only if your identity has the asgard trait (data). Action: Heal 2
  // damage from your identity. You may discard a status card from your identity. "You may": each status option is
  // offered only while your identity actually carries it, plus an explicit "decline" option, so the choice can
  // resolve to discarding nothing at all.
  "25024.godlike-stamina-action": action(
    heal(2, yourIdentity),
    chooseOne(
      option(
        "Discard the stunned status",
        { when: hasStatus(yourIdentity, "stunned") },
        removeStatus(yourIdentity, "stunned"),
      ),
      option(
        "Discard the confused status",
        { when: hasStatus(yourIdentity, "confused") },
        removeStatus(yourIdentity, "confused"),
      ),
      option(
        "Discard the tough status",
        { when: hasStatus(yourIdentity, "tough") },
        removeStatus(yourIdentity, "tough"),
      ),
      option("Do not discard a status card"),
    ),
  ),

  // Problem Solvers (event x3, 25033, Justice) — Alliance (data). Hero Action (thwart): Exhaust an avenger character
  // and a guardian character → remove X threat from each scheme, where X is equal to the combined THW of those
  // characters. docs/phase7-wave4.md §3.17's own worked example for this exact card.
  "25033.problem-solvers-action": heroAction(
    {
      label: "thwart",
      cost: exhaustEachCost({
        avenger: query(["identity", "ally"], { trait: AVENGER }),
        guardian: query(["identity", "ally"], { trait: GUARDIAN }),
      }),
    },
    thwart(sum(statOf(chosen("avenger"), "thw"), statOf(chosen("guardian"), "thw")), each(query("scheme"))),
  ),

  // Leadership Training (support x2, 25034, Leadership) — Max 2 per deck. Uses (2 training counters) (data).
  // Alter-ego Action: Exhaust this card and remove 1 training counter from it → choose a leadership (blue) event in
  // your discard pile and shuffle it into your deck. The "Defensive Training" shape (`wave4/nebu/nebula-pack-
  // cards.ts` 22034), leadership in place of protection.
  "25034.leadership-training-constant": alterEgoAction(
    { cost: [exhaustThis, removeCounter("training", 1)] },
    chooseCards("found", zone("discard", you, { filter: query("event", { aspect: "leadership" }) }), {
      min: 1,
      max: 1,
    }),
    moveCards(cards(chosen("found")), "deckShuffle"),
  ),

  // Anticipation (upgrade x3, 25035, Protection) — Max 1 per player (data). Hero Interrupt: When you engage a
  // minion, discard this card → ready your hero. `{ on: "minionEngaged", playerIs: "controller" }` is the landed
  // primitive for "you engage a minion" (`wave1/thor/kit.ts`'s own "Have at Thee" comment; `wave2/wsp/pack-
  // cards.ts`'s "Lie in Wait"), used here as an interrupt rather than those two cards' response.
  "25035.anticipation-interrupt": heroInterrupt(
    { on: "minionEngaged", playerIs: "controller" },
    { cost: discardThis },
    ready(yourIdentity),
  ),

  // Cosmic Alliance (event x3, 25036, Basic) — Alliance (data). Hero Action: Choose an avenger character and a
  // guardian character → ready each of those characters. `excludeSlots` keeps the same character from filling both
  // slots (RRG 1.8 "Choose (Distinct Targets)", p. 12 — implicit for two named categories in one sentence).
  "25036.cosmic-alliance-action": heroAction(
    chooseTarget("avenger", query(["identity", "ally"], { trait: AVENGER })),
    chooseTarget("guardian", query(["identity", "ally"], { trait: GUARDIAN, excludeSlots: ["avenger"] })),
    ready(chosen("avenger")),
    ready(chosen("guardian")),
  ),
});
