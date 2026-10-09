/**
 * Full QA, piece 10a (docs/phase7-wave8-full-qa.md, "Defects found"), proved on REAL cards: Psionic Illusion (41028,
 * Psylocke's nemesis attachment) against an "(attack)" ability whose attack begins before the instruction that deals
 * its damage (owner decision of 2026-10-08, docs/phase7-wave8.md §4.1 row 73).
 *
 * Psionic Illusion: "Forced Interrupt: When you attack an enemy, name a resource type and discard the top card of your
 * deck. If the discarded card does not have a resource of the named type, change the target of this attack to a
 * friendly character of your choice and discard this card." Repulsor Blast (01031): "Hero Action (attack): Deal 1
 * damage to an enemy and discard the top 5 cards of your deck. For each printed [energy] resource discarded this way,
 * deal 2 additional damage to that enemy." Its attack begins with the ability (RRG 1.8 "Labeled Ability", p. 26), so
 * the Illusion's window resolves before the five cards are discarded and the damage is dealt after.
 *
 * Before the fix the `attack` instruction gave the begun attack the enemy it names again: the damage and any retaliate
 * landed on the enemy while the retarget was logged and the Illusion discarded itself for nothing. The rule is the
 * engine's (`packages/engine/src/resolve/attack-ability.ts`, "A target changed in the attack's window"; fixtures in
 * the engine's `attack-begin-retarget.test.ts`); no card script was changed.
 */
import { cardId, PLAYABLE_CARDS } from "@mc/content";
import { createGame, type CardInstance, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, identityOf, inst, P1, patchInstance, payWith, play, playerOf, settle } from "./testing/harness.js";
import type { Picker } from "./testing/harness.js";
import { driveEventsPicking, withForm } from "./testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "./wave7/index.js";

vi.setConfig({ testTimeout: 120_000 });

const ILLUSION = "41028";
const FLURRY = "41004"; // Flurry of Blades: an [energy] card, put on top of the deck for the Illusion to discard.
const REPULSOR = "01031";

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/**
 * Psylocke (hero form) against Stryfe with no tough card, Psionic Illusion attached to her identity (surgery: her own
 * set-aside copy, as if revealed earlier), Flurry of Blades on top of her deck and Repulsor Blast in hand (a deck card
 * relabeled; the card is added to this game's pool).
 */
function staged(): { readonly state: GameState; readonly illusion: InstanceId; readonly blast: InstanceId } {
  const created = createGame(
    wave7Scenario("stryfe", {
      players: [{ starterDeckId: "psylocke-justice" }],
      seed: 1,
      difficulty: "standard",
      modularSetIds: ["mutant_slayers"],
    }),
    WAVE7_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE7_DEPS);
  s = withForm(s, { heroForm: 0 }, P1);
  s = patchInstance({ ...s, villainArea: [] }, s.mainScheme.instanceId, { threat: 4 });
  s = patchInstance(s, stryfe(s), { statuses: { ...inst(s, stryfe(s)).statuses, tough: 0 } });
  const identity = identityOf(s, P1);
  const illusion = playerOf(s, P1).setAside.find((id) => codeOf(s, id) === ILLUSION)!;
  s = { ...s, players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((id) => id !== illusion) })) };
  s = patchInstance(s, illusion, {
    home: { kind: "player" },
    attachedTo: identity,
    controllerId: P1,
    faceup: true,
  } as unknown as Partial<CardInstance>);
  s = patchInstance(s, identity, { attachments: [...inst(s, identity).attachments, illusion] });
  const repulsor = PLAYABLE_CARDS.find((card) => card.id === cardId(REPULSOR))!;
  s = { ...s, cardPool: { ...s.cardPool, [repulsor.id]: repulsor } };
  const owner = playerOf(s, P1);
  const all = [...owner.deck, ...owner.hand, ...owner.discard];
  const flurry = all.find((id) => codeOf(s, id) === FLURRY)!;
  const blast = owner.deck.find((id) => id !== flurry)!;
  s = patchInstance(s, blast, { cardId: repulsor.id });
  const without = (zone: readonly InstanceId[]) => zone.filter((id) => id !== flurry && id !== blast);
  s = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1
        ? { ...p, deck: [flurry, ...without(p.deck)], hand: [...without(p.hand), blast], discard: without(p.discard) }
        : p,
    ),
  };
  return { state: s, illusion, blast };
}

/** Names `type` for the Illusion, attacks Stryfe, and answers every other prompt with the first legal option. */
const naming =
  (type: string, enemy: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      const hit = choice.options.find((o) => o.label.startsWith(`Name ${type}`));
      if (hit) return [hit.optionId];
    }
    const offered = choice?.options.map((o) => o.optionId) ?? [];
    return offered.includes(enemy) ? [enemy] : firstLegal(s);
  };

function playBlast(type: string) {
  const { state, illusion, blast } = staged();
  const cost = state.cardPool[cardId(REPULSOR)]!;
  const payment = payWith(state, P1, "cost" in cost && typeof cost.cost === "number" ? cost.cost : 0, [blast]);
  const driven = driveEventsPicking(WAVE7_DEPS, state, naming(type, stryfe(state)), play(P1, blast, payment));
  return { before: state, illusion, ...driven };
}

describe("Psionic Illusion (41028) against Repulsor Blast (01031), an attack that begins before its damage", () => {
  it("the named type is missing: the whole attack lands on the friendly character, and Stryfe takes nothing", () => {
    const { before, state, events, illusion } = playBlast("mental");
    const hero = identityOf(state, P1);
    const [moved] = ofType(events, "playerAttackRetargeted");
    expect(moved).toMatchObject({ attackerInstanceId: hero, fromInstanceId: stryfe(before) });
    const target = moved!.targetInstanceId;
    // The Illusion discarded Flurry of Blades, and its window resolved before the attack's damage step.
    expect(playerOf(state, P1).discard.map((id) => codeOf(state, id))).toContain(FLURRY);
    expect(events.indexOf(moved!)).toBeLessThan(events.indexOf(ofType(events, "attackResumed")[0]!));
    const attacks = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
    );
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.targetInstanceId).toBe(target);
    expect(ofType(events, "attackResumed")).toMatchObject([{ targetInstanceId: target }]);
    // Repulsor Blast's 1 damage, plus 2 for each [energy] among the five discarded, all to the new target.
    const amount = ofType(events, "attackResumed")[0]!.amount;
    expect(amount).toBeGreaterThanOrEqual(1);
    expect(damageOf(state, target) - damageOf(before, target)).toBe(amount);
    expect(damageOf(state, stryfe(state))).toBe(damageOf(before, stryfe(before)));
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === stryfe(before))).toEqual([]);
    // "… and discard this card."
    expect(inst(state, hero).attachments).not.toContain(illusion);
    expect(Object.values(state.encounterDecks).flatMap((deck) => deck.discard)).toContain(illusion);
  });

  it("the named type is there: the attack stands, Stryfe takes it and the Illusion stays", () => {
    const { before, state, events, illusion } = playBlast("energy");
    expect(ofType(events, "playerAttackRetargeted")).toEqual([]);
    const amount = ofType(events, "attackResumed")[0]!.amount;
    expect(amount).toBeGreaterThanOrEqual(1);
    expect(damageOf(state, stryfe(state)) - damageOf(before, stryfe(before))).toBe(amount);
    expect(inst(state, identityOf(state, P1)).attachments).toContain(illusion);
  });
});
