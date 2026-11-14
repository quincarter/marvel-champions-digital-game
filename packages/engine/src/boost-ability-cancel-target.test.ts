/**
 * "Cancel that card's 'Boost' ability" on a boost card that has none: no valid target, so the ability cannot be
 * initiated and its cost is not paid (RRG 1.8 "Target", p. 42; "Cost", p. 13; FAQ "Attacrobatics (#6)", p. 59, a card
 * with no boost icons is no target for cancelling them). The same for a bare cancel (Wraith 22012, Target Acquired
 * 08024) and one with a "Then" (Killer Instinct 63001a; RRG 1.8 "'Then'", p. 44). Whether the card has a Boost ability
 * is printed card data (`printsBoostAbility`, the boost-area star; RRG 1.8 "Boost, Boost Icon", p. 11), so a Boost not
 * scripted yet still counts (`select.ts` `hasBoostAbility`). Synthetic cards.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { hasBoostAbility } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubTreachery } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay } from "./testing/wave3.js";

const onFlip: AbilityDefinition["trigger"] = {
  kind: "interrupt",
  forced: false,
  on: { on: "boostCardTurnedFaceup" },
};
/** Wraith's shape (22012): "Hero Interrupt: When a boost card is turned faceup, exhaust Wraith and deal 1 damage to him → cancel that card's 'Boost' effect." */
const WRAITH_CANCEL = stubAbility("wraith.interrupt", {
  trigger: onFlip,
  cost: { exhaustSelf: true, damageThisCard: 1 },
  effects: [{ kind: "cancelBoostAbility" }],
});
const WRAITH = stubAlly({ id: "wraith", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [WRAITH_CANCEL.ref] });

/** Two boost icons, no star: no Boost ability. */
const PLAIN = stubTreachery({ id: "plain", boostIcons: 2 });
/** A printed star whose Boost is not scripted: the registry has nothing for it, the card data says it has one. */
const UNSCRIPTED = stubTreachery({ id: "unscripted", boostIcons: 1, starIcon: true });
/** A Boost in the registry on a card whose data prints no star (a data error): not read as printed. */
const REGISTRY_ONLY_BOOST = stubAbility("registry-only.boost", { trigger: { kind: "boost" }, effects: [] });
const REGISTRY_ONLY = stubTreachery({ id: "registry-only", boostIcons: 1, abilities: [REGISTRY_ONLY_BOOST.ref] });
/** A star that stands for a Boost another card grants (Purple Man's set): no Boost of its own. */
const GRANTED_STAR = {
  ...stubTreachery({ id: "granted-star", boostIcons: 1, starIcon: true }),
  boostGrantedBy: [PLAIN.id],
};

const deps = depsOf(WRAITH_CANCEL, REGISTRY_ONLY_BOOST);

/** P1 in hero form with Wraith in play; `top` is the villain's boost card in the coming villain phase. */
function start(top: CardId): { state: GameState; wraith: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [WRAITH, PLAIN, UNSCRIPTED, REGISTRY_ONLY, GRANTED_STAR],
    deps,
    encounter: copiesOf(PLAIN.id, 10).concat([UNSCRIPTED.id, REGISTRY_ONLY.id, GRANTED_STAR.id]),
    deck: [WRAITH.id],
  });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const ally = playerCardIntoPlay(hero, WRAITH.id, P1);
  return { state: onTopOfEncounterDeck(ally.state, top), wraith: ally.id };
}

/** Runs the villain phase, taking Wraith's interrupt whenever it is offered; counts the offers. */
function villainPhase(state: GameState) {
  let offered = 0;
  const { session, events } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const option = choice.options.find(
        (o) => o.ref.kind === "ability" && (o.ref.abilityId as string) === WRAITH_CANCEL.ref.id,
      );
      if (option) {
        offered++;
        return [option.optionId];
      }
    }
    return defaultPick(s);
  });
  return { state: session.state, events, offered };
}

describe("a bare 'cancel its Boost ability' (Wraith's shape) needs a Boost ability to cancel", () => {
  it("not offered on a card with no Boost ability: Wraith is not exhausted and takes no damage", () => {
    const s = start(PLAIN.id);
    const after = villainPhase(s.state);
    expect(after.offered).toBe(0);
    expect(mustInstance(after.state, s.wraith)).toMatchObject({ exhausted: false, damage: 0 });
    expect(after.events.some((e) => e.type === "boostCancelled")).toBe(false);
  });

  it("offered on a card whose star prints a Boost, scripted or not: the cost is paid and the ability cancelled", () => {
    const s = start(UNSCRIPTED.id);
    const after = villainPhase(s.state);
    expect(after.offered).toBe(1);
    expect(mustInstance(after.state, s.wraith)).toMatchObject({ exhausted: true, damage: 1 });
    expect(after.events).toContainEqual(expect.objectContaining({ type: "boostCancelled", scope: "ability" }));
  });
});

describe("hasBoostAbility reads card data, not the registry", () => {
  const s = gameAtFirstTurn({
    cards: [PLAIN, UNSCRIPTED, REGISTRY_ONLY, GRANTED_STAR],
    deps,
    encounter: [PLAIN.id, UNSCRIPTED.id, REGISTRY_ONLY.id, GRANTED_STAR.id],
  });
  const idOf = (card: string) => {
    const id = Object.keys(s.instances).find((i) => (s.instances[i]?.cardId as string) === card);
    if (!id) throw new Error(`no ${card}`);
    return id as never;
  };

  it("a printed star: true, with nothing scripted", () => {
    expect(hasBoostAbility(s, deps, idOf(UNSCRIPTED.id))).toBe(true);
  });
  it("no star: false, even with a boost-triggered ability in the registry", () => {
    expect(hasBoostAbility(s, deps, idOf(REGISTRY_ONLY.id))).toBe(false);
    expect(hasBoostAbility(s, deps, idOf(PLAIN.id))).toBe(false);
  });
  it("a star standing for another card's grant, outside a boost area: false (`printsBoostAbility`)", () => {
    expect(hasBoostAbility(s, deps, idOf(GRANTED_STAR.id))).toBe(false);
  });
  it("the identity of P1 is no boost card at all", () => {
    expect(hasBoostAbility(s, deps, mustPlayer(s, P1).identity.instanceId)).toBe(false);
  });
});
