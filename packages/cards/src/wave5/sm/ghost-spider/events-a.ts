import {
  attachCard,
  attackAnEnemy,
  cancelIt,
  cancelWhenRevealed,
  chooseCards,
  chosen,
  countBoostIcons,
  coveredByEngineRule,
  dealDamage,
  defineAbilities,
  eventTarget,
  heroInterrupt,
  heroResponse,
  ifThen,
  inPlay,
  maxOnePerTriggeringInstance,
  moveCards,
  named,
  on,
  oneCopyOf,
  query,
  refMatches,
  scaled,
  shuffleDeck,
  theVillain,
  thwartAScheme,
  varOf,
  you,
  YOUR_IDENTITY,
  zone,
  alterEgoAction,
} from "../../../dsl/index.js";

/**
 * Ghost-Spider's own signature events, part A (`sm` 27002–27006, MC27 p. 5, docs/phase7-wave5.md). Part B
 * (27013–27019) is a separate module/agent.
 *
 * **Ghost Kick (27002)** and **Phantom Flip (27004)**: "Hero Response (attack/thwart): After Ghost-Spider uses a
 * basic power, deal 6 damage to an enemy. / remove 5 threat from a scheme. (Max 1 per basic power use.)" The
 * `(attack)`/`(thwart)` label (RRG 1.8 p. 710/3518: resolving a labeled ability "is considered to" attack/thwart the
 * named target) is why these use `attackAnEnemy`/`thwartAScheme` — the real attack/thwart mechanic, not a bare
 * `dealDamage`/`removeThreat` — the same shape as Core's Swinging Web Kick (`01005`, `heroAction({ label: "attack" },
 * attackAnEnemy(8))`) and "For Justice" (`thwartAScheme`). The trigger is `on.basicPowerUsed(YOUR_IDENTITY)`
 * (§3.32's `abilityTiming`-adjacent existing vocabulary; wave2/wave3 precedent, Quicksilver's Super Speed and
 * Groot's Lashing Vines) — `YOUR_IDENTITY`, not `self`, since these are events, not attached to a specific
 * character. "(Max 1 per basic power use.)" is §3.14's `maxOnePerTriggeringInstance` (shared per copy of the
 * card's title, across every triggering instance of that one basic-power use).
 *
 * **Pirouette and Punch (27005)**: "Hero Interrupt: When a card is revealed from the encounter deck, deal damage to
 * the villain equal to 1 more than the boost icons on that card. Cancel that card's 'When Revealed' effects." —
 * the same `on.encounterCardRevealed()` + `cancelWhenRevealed()` shape as Core's Enhanced Spider-Sense (`01004`),
 * with the damage amount read live off the revealed card (`eventTarget`, the card whose reveal is interrupted;
 * `countBoostIcons` + `scaled(…, { plus: 1 })`) instead of a fixed number, aimed at the villain (`theVillain`, RRG
 * 1.8 "Villain", p. 51: "the active villain") rather than a chosen enemy.
 *
 * **Web Binding (27006)**: "Requirement ([mental])." needs no ability script — the engine reads the printed
 * `keywords` (`packages/content/src/data/sm/cards.ts`) to enforce spending only listed resources at payment
 * (`legal.ts`/`actions.ts`). "Hero Interrupt: When an enemy would activate, cancel that activation. If a minion's
 * activation was cancelled this way, deal 4 damage to that minion." is §3.2's own worked example
 * (`packages/engine/src/enemy-activating.test.ts`'s `BINDING` fixture, here as a real Hero Interrupt rather than
 * a Forced one, so the player is offered the choice instead of it firing automatically): `on.enemyActivating()`
 * with no filter ("an enemy" is any enemy activating, minion or villain), `cancelIt()`, then a conditional
 * `dealDamage` gated on `refMatches(eventTarget, query("minion"))` ("that minion" — a cancelled villain
 * activation deals no damage). §4.1 Q3: a cancelled activation did not happen, so nothing else here needs to
 * account for "after it activates".
 *
 * **Parental Guidance (27003)**: "Alter-Ego Action: If George Stacy is in play, attach 1 event from your hand or
 * discard pile facedown to George Stacy. If George Stacy is not in play, search your deck and discard pile for
 * him and add him to your hand. (Shuffle.)" One `alterEgoAction` with an `ifThen` on `inPlay("George Stacy")`
 * (George Stacy, `27007`, is unique, so `named`/`inPlay` find him without a choice); the two bullet lines parse
 * into `.parental-guidance-constant`/`-constant-2` refs the same way Double Time's two options do
 * (`wave2/qsv/kit.ts`), stood up empty here since `.parental-guidance-action` implements both branches directly.
 * The facedown attach carries no "(to a maximum of 3)" of its own — that cap is printed on George Stacy's own
 * Action (`27007`, `support-upgrades-allies.ts`, a different module/agent), not on this card. "Search your deck
 * and discard pile … and add him to your hand. (Shuffle.)" is the `oneCopyOf` + `moveCards` + `shuffleDeck` shape
 * `wave3/stld/star-lord-kit.ts`'s Peter Quill setup uses for the identical "search deck and discard, add to hand"
 * sentence.
 */

export const GHOST_SPIDER_EVENTS_A = defineAbilities({
  "27002.ghost-kick-response": heroResponse(
    on.basicPowerUsed(YOUR_IDENTITY),
    { label: "attack", limit: maxOnePerTriggeringInstance },
    attackAnEnemy(6),
  ),

  "27003.parental-guidance-action": alterEgoAction(
    ifThen(
      inPlay("George Stacy"),
      [
        chooseCards("event", zone(["hand", "discard"], you, { filter: query("event") }), { min: 1, max: 1 }),
        attachCard(chosen("event"), named("George Stacy"), { facedown: true }),
      ],
      [
        moveCards(
          oneCopyOf(zone(["deck", "discard"], you, { filter: query("support", { name: "George Stacy" }) })),
          "hand",
        ),
        shuffleDeck(),
      ],
    ),
  ),
  "27003.parental-guidance-constant": coveredByEngineRule(),
  "27003.parental-guidance-constant-2": coveredByEngineRule(),

  "27004.phantom-flip-response": heroResponse(
    on.basicPowerUsed(YOUR_IDENTITY),
    { label: "thwart", limit: maxOnePerTriggeringInstance },
    thwartAScheme(5),
  ),

  "27005.pirouette-and-punch-interrupt": heroInterrupt(
    on.encounterCardRevealed(),
    countBoostIcons(eventTarget, "revealed"),
    dealDamage(scaled(varOf("revealed.boostIcons"), { plus: 1 }), theVillain),
    cancelWhenRevealed(),
  ),

  "27006.web-binding-interrupt": heroInterrupt(
    on.enemyActivating(),
    cancelIt(),
    ifThen(refMatches(eventTarget, query("minion")), dealDamage(4, eventTarget)),
  ),
});
