import { trait } from "@mc/content";
import type { PlayerRef, TargetQuery } from "@mc/engine";
import {
  alterEgoAction,
  attack,
  chooseCards,
  chooseOneBy,
  choosePlayer,
  chosen,
  chosenPlayer,
  chooseTarget,
  defineAbilities,
  discardEncounterUntil,
  enemyAttack,
  exhaust,
  heal,
  healYourIdentityCost,
  heroAction,
  heroInterrupt,
  ifThen,
  option,
  paidWith,
  preventDamage,
  putIntoPlay,
  query,
  ready,
  removeThreat,
  repeatWhile,
  revealCard,
  spendResources,
  teamUpCharacters,
  theMainScheme,
  theVillain,
  thwart,
  varAtLeast,
  when,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";

/**
 * Ghost-Spider's own signature events, part B (`sm` 27013–27019, MC27 p. 5, docs/phase7-wave5.md). Part A
 * (27002–27006) is a separate module/agent; the rest of the box's Ghost-Spider abilities are in
 * `support-upgrades-allies.ts`, `identity.ts` and `obligation-nemesis.ts`.
 *
 * **Bait and Switch (27013)**: "Hero Action (thwart): The villain attacks you. Remove 4 threat from the main
 * scheme." is printed identically at `15030` (`scw` Scarlet Witch pack, `wave2/scw/pack-cards.ts`), whose own
 * ability (`enemyAttack(theVillain, { against: you })` then a plain `thwart(4, theMainScheme)` under the ability's
 * own "(thwart)" label — "the main scheme", not "a scheme", so the real target is named directly rather than
 * offering a choice `thwartAScheme` would) is reused verbatim here.
 *
 * **Jump Flip (27014)**: "Hero Interrupt (defense): When you would take any amount of damage, prevent 2 of that
 * damage. If you paid for this card using a [energy] resource, remove 2 threat from the main scheme." — the same
 * `preventDamage` + `ifThen(paidWith(...), …)` shape §3.32 already cites for this exact card, with the second
 * sentence a plain `removeThreat` (unlabeled — only "prevent … damage" carries the ability's own "(defense)" label)
 * against `theMainScheme` (a printed, not chosen, target).
 *
 * **Return the Favor (27015)**: "Hero Action (attack): Discard cards from the top of the encounter deck until you
 * discard a treachery. Reveal that treachery → deal 5 damage to the villain." `discardEncounterUntil` +
 * `revealCard` (the Core Standard set's own Rampage idiom, `wave1/thor/kit.ts`'s "Defender of the Nine Realms"
 * precedent for the same "discard until X, then act" shape) then a real `attack(5, theVillain)` under the
 * "(attack)" label — not a bare `dealDamage`, so Retaliate/Guard/a Stunned attacker are read the normal way. Ruling
 * Apr 30, 2026 (2): paying this cost can Stun the hero (the revealed treachery's own "When Revealed" resolves as
 * part of `revealCard`, same as any other reveal) or let a Guard minion engage, in which case Step 6's real attack
 * effect fizzles the same way Core's basic attack/thwart actions already do — no extra scripting needed here, the
 * same reasoning `wave1/thor/kit.ts`'s own docblock gives for "Defender of the Nine Realms".
 *
 * **What Doesn't Kill Me (27016)**: "Requirement ([physical])" is schema-level data (Web Binding's own precedent,
 * `events-a.ts`) — no ability ref needed for it. "Hero Action: Heal 2 damage from your hero → ready your hero." is
 * a real cost → effect: `healYourIdentityCost(2)` (Captain Marvel's "Rechannel", `01010a`; Doctor Strange's
 * "Momentum Shift", `09016`) then `ready(yourIdentity)`.
 *
 * **Across the Spider-Verse (27018)**: "Max 1 per deck." is a `deckLimit`/`quantityInSet` fact already on the card
 * record. "Hero Action: Exhaust a Web-Warrior card you control → search your discard pile for a Web-Warrior ally
 * and put it into play, then choose a player. That player may spend 3 resources of any type to repeat this
 * ability." resolves the "exhaust a Web-Warrior card / search discard / put into play" sentence for `you` once
 * unconditionally, then a `repeatWhile` loop whose body is exactly the printed "choose a player, they may spend 3
 * to repeat" tail: `choosePlayer` (RRG 1.8 "Choose", p. 12: no printed chooser defaults to the ability's own
 * controller, so `you` — the original activator — keeps making this choice every time, never the newly chosen
 * player), then a `chooseOneBy(chosenPlayer(...), …)` offering that player the spend, and only *if they pay* does
 * this same sentence run again for them (RRG 1.8 "Across the Spider-Verse" FAQ, p. 62/63: "repeating the ability on
 * this card includes the repeat effect itself. As long as a player who can spend 3 resources and exhaust a
 * Web-Warrior card can be chosen, the ability can be repeated" — read here as the chosen player becoming the new
 * "you" for their own copy of the exhaust/search/put-into-play sentence, which is exactly what `repeatWhile`
 * re-running its own effects, parametrized on `chosenPlayer("player")`, gives for free; a player with no legal
 * Web-Warrior card to exhaust or no matching ally in their discard pile just has those steps resolve as no-ops,
 * the same forgiving "chooseCards `min: 0`, then act on whatever was chosen" idiom `identity.ts`'s own docblock
 * uses for Gwen Stacy's "shuffle Ticket to the Multiverse … if it's there"). `spendResources`'s own `<bind>.made`
 * var (`wave4/mts/thanos.ts`'s "Sanctuary" precedent) is both the loop's own decision flag and its `while`
 * condition, so a decline (no `spendResources` call at all in that branch) reads as `0`/`false` and ends the loop.
 *
 * **Young Love (27019)**: "Team-Up (Gwen Stacy and Miles Morales)" is the printed `teamUp` keyword (schema data).
 * "Max 1 per deck." is `deckLimit`. "Alter-Ego Action: Heal 3 damage each from Gwen Stacy and Miles Morales." is
 * `teamUpCharacters()`'s own docblock example verbatim (`dsl/values.ts` §3.34) — `heal(3, teamUpCharacters())`
 * heals both named characters (whoever controls them) in one effect, the same "every character a Team-Up card
 * names, as one ref" shape `wave3/gmw/groot-kit.ts`'s "Flora and Fauna" uses for `ready(teamUpCharacters(0))`.
 */

const WEB_WARRIOR = trait("WEB-WARRIOR");
const A_WEB_WARRIOR_CARD: TargetQuery = { categories: ["identity", "ally", "upgrade", "support"], trait: WEB_WARRIOR };

/** "Exhaust a Web-Warrior card you control → search your discard pile for a Web-Warrior ally and put it into play." */
const exhaustSearchAndPutIntoPlay = (actor: PlayerRef) => [
  chooseTarget("webWarrior", { ...A_WEB_WARRIOR_CARD, controlledBy: actor, exhausted: false }, { chooser: actor }),
  exhaust(chosen("webWarrior")),
  chooseCards("found", zone("discard", actor, { filter: query("ally", { trait: WEB_WARRIOR }) }), { min: 0, max: 1 }),
  putIntoPlay(chosen("found"), actor),
];

/** "…then choose a player. That player may spend 3 resources of any type to repeat this ability." */
const CHOOSE_A_PLAYER_WHO_MAY_REPEAT = [
  choosePlayer("player"),
  chooseOneBy(
    chosenPlayer("player"),
    option("Spend 3 resources of any type to repeat", spendResources({ generic: 3 }, "paid", chosenPlayer("player"))),
    option("Do not repeat"),
  ),
  ifThen(varAtLeast("paid.made"), exhaustSearchAndPutIntoPlay(chosenPlayer("player"))),
];

export const GHOST_SPIDER_EVENTS_B = defineAbilities({
  "27013.bait-and-switch-action": heroAction(
    { label: "thwart" },
    enemyAttack(theVillain, { against: you }),
    thwart(4, theMainScheme),
  ),

  "27014.jump-flip-interrupt": heroInterrupt(
    when.damage(YOUR_IDENTITY),
    { label: "defense" },
    preventDamage(2),
    ifThen(paidWith("energy"), removeThreat(2, theMainScheme)),
  ),

  "27015.return-the-favor-action": heroAction(
    { label: "attack" },
    discardEncounterUntil(query("treachery"), "found"),
    revealCard(chosen("found")),
    attack(5, theVillain),
  ),

  "27016.what-doesnt-kill-me-action": heroAction({ cost: healYourIdentityCost(2) }, ready(yourIdentity)),

  "27018.across-the-spider-verse-action": heroAction(
    ...exhaustSearchAndPutIntoPlay(you),
    repeatWhile(varAtLeast("paid.made"), CHOOSE_A_PLAYER_WHO_MAY_REPEAT),
  ),

  "27019.young-love-action": alterEgoAction(heal(3, teamUpCharacters())),
});
