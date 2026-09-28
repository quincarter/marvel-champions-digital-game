import { cardId } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  maxHitPoints,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  putOnTopOfDeck,
  resourceAbility,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { ironheartScenario } from "./support.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";

const ironheartVsRhino = (seed = 1) => startWave5Game(ironheartScenario("rhino", { seed }));
const ironheartInHeroForm = (seed = 1) => runWave5(ironheartVsRhino(seed), toHero(P1));

/** Test-only surgery (`events.test.ts`'s own `forceVersion` precedent): forces Ironheart onto a given Version
 * directly, without paying Level Up!'s own cost, purely to exercise a Version-dependent card in isolation. */
function forceVersion(state: GameState, player: PlayerId, version: "29001a" | "29002a" | "29003a"): GameState {
  const identity = identityOf(state, player);
  const id = cardId(version);
  return {
    ...state,
    instances: { ...state.instances, [identity]: { ...inst(state, identity), cardId: id } },
    players: state.players.map((p) => (p.playerId === player ? { ...p, identity: { ...p.identity, cardId: id } } : p)),
  };
}

/** Accepts the named optional response/option (by ability id suffix or option label), declining everything else
 * (`events.test.ts`'s sibling packs' own `accepting()` precedent, `wave5/nova/support-upgrades-allies.test.ts`). */
const accepting =
  (wanted: string, want: readonly InstanceId[] = []): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseCards") return want;
    const hits = choice.options
      .filter((o) => o.optionId === wanted || o.optionId.endsWith(`:${wanted}`) || o.label === wanted)
      .map((o) => o.optionId);
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

const refused = (state: GameState, command: Command): string => {
  const result = applyCommand(state, command, WAVE5_DEPS);
  if (result.ok) throw new Error("expected the play to be refused");
  return result.error.code;
};

describe("Ironheart's supports, upgrades and resources (29009-29013, 29020-29021, 29026-29027)", () => {
  describe("29009.stroke-of-genius-response", () => {
    it("after it's spent, places 1 progress counter on the identity and draws 1 card", () => {
      const alterEgo = ironheartVsRhino();
      const identity = identityOf(alterEgo, P1);
      const given = moveToHand(alterEgo, P1, "29010", "29009"); // Ronnie Williams (cost 1, wild) + Stroke of Genius.
      const [ronnie, stroke] = given.ids as [InstanceId, InstanceId];
      const beforeCounters = inst(given.state, identity).counters.progress ?? 0;
      const beforeHand = playerOf(given.state, P1).hand.length;
      const after = settle(
        runWave5(given.state, play(P1, ronnie, [stroke])),
        accepting("29009.stroke-of-genius-response"),
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, identity).counters.progress ?? 0).toBe(beforeCounters + 1);
      // -1 Ronnie Williams played, -1 Stroke of Genius spent, +1 drawn by the response.
      expect(playerOf(after, P1).hand.length).toBe(beforeHand - 2 + 1);
    });
  });

  describe("29010.ronnie-williams-action", () => {
    it("exhausts and heals 2 damage from the identity when that option is chosen", () => {
      const alterEgo = ironheartVsRhino();
      const identity = identityOf(alterEgo, P1);
      const damaged = patchInstance(alterEgo, identity, { damage: 3 });
      const { state: withRonnie, id: ronnie } = playFromHand(damaged, "29010", 1);
      const after = settle(
        runWave5(withRonnie, use(P1, ronnie, "29010.ronnie-williams-action")),
        accepting("Heal 2 damage from Riri Williams."),
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, identity).damage).toBe(1);
      expect(inst(after, ronnie).exhausted).toBe(true);
    });

    it("exhausts and places 1 progress counter on the identity when that option is chosen instead", () => {
      const alterEgo = ironheartVsRhino();
      const identity = identityOf(alterEgo, P1);
      const { state: withRonnie, id: ronnie } = playFromHand(alterEgo, "29010", 1);
      const before = inst(withRonnie, identity).counters.progress ?? 0;
      const after = settle(
        runWave5(withRonnie, use(P1, ronnie, "29010.ronnie-williams-action")),
        accepting("Place 1 progress counter on Riri Williams."),
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, identity).counters.progress ?? 0).toBe(before + 1);
      expect(inst(after, ronnie).exhausted).toBe(true);
    });

    it("an already-exhausted Ronnie Williams cannot pay the cost", () => {
      const alterEgo = ironheartVsRhino();
      const { state: withRonnie, id: ronnie } = playFromHand(alterEgo, "29010", 1);
      const exhausted = patchInstance(withRonnie, ronnie, { exhausted: true });
      expect(refused(exhausted, use(P1, ronnie, "29010.ronnie-williams-action"))).toBe("already_exhausted");
    });
  });

  describe("29011.tony-stark-ai-action", () => {
    it("exhausts, adds 1 of the top 2 deck cards to hand, and discards the other", () => {
      const alterEgo = ironheartVsRhino();
      const withDeck = putOnTopOfDeck(alterEgo, P1, "29018", "29019").state;
      const { state: withAI, id: ai } = playFromHand(withDeck, "29011", 2);
      const beforeHand = playerOf(withAI, P1).hand.length;
      const beforeDiscard = playerOf(withAI, P1).discard.length;
      const after = settle(
        runWave5(withAI, use(P1, ai, "29011.tony-stark-ai-action")),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, ai).exhausted).toBe(true);
      expect(playerOf(after, P1).hand.length).toBe(beforeHand + 1);
      expect(playerOf(after, P1).discard.length).toBe(beforeDiscard + 1);
      const inHand = playerOf(after, P1).hand.map((id) => after.instances[id]?.cardId);
      const wasTop = [cardId("29018"), cardId("29019")];
      expect(inHand.some((c) => wasTop.includes(c!))).toBe(true);
    });
  });

  describe("29012.photon-blasters-constant / 29012.photon-blasters-action", () => {
    it("gives Ironheart +2 hit points", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const before = maxHitPoints(hero, identity, WAVE5_DEPS)!;
      const { state } = playFromHand(hero, "29012", 2);
      expect(maxHitPoints(state, identity, WAVE5_DEPS)).toBe(before + 2);
    });

    it("Version 1: exhausts and deals 1 damage to an enemy (equal to the version number)", () => {
      const hero = ironheartInHeroForm();
      const villain = hero.villains[0]!.instanceId;
      const { state: withBlasters, id: blasters } = playFromHand(hero, "29012", 2);
      const before = inst(withBlasters, villain).damage;
      const after = settle(
        runWave5(withBlasters, use(P1, blasters, "29012.photon-blasters-action")),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, blasters).exhausted).toBe(true);
      expect(inst(after, villain).damage).toBe(before + 1);
    });

    it("Version 3: exhausts and deals 3 damage to an enemy (equal to the version number)", () => {
      const hero = ironheartInHeroForm(2);
      const v3 = forceVersion(hero, P1, "29003a");
      const villain = v3.villains[0]!.instanceId;
      const { state: withBlasters, id: blasters } = playFromHand(v3, "29012", 2);
      const before = inst(withBlasters, villain).damage;
      const after = settle(
        runWave5(withBlasters, use(P1, blasters, "29012.photon-blasters-action")),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, villain).damage).toBe(before + 3);
    });
  });

  describe("29013.propulsion-jets-constant / 29013.propulsion-jets-action", () => {
    it("gives Ironheart +2 hit points", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const before = maxHitPoints(hero, identity, WAVE5_DEPS)!;
      const { state } = playFromHand(hero, "29013", 2);
      expect(maxHitPoints(state, identity, WAVE5_DEPS)).toBe(before + 2);
    });

    it("Version 1: exhausts and removes 1 threat from a scheme (equal to the version number)", () => {
      const hero = ironheartInHeroForm();
      const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
      const { state: withJets, id: jets } = playFromHand(withThreat, "29013", 2);
      const after = settle(
        runWave5(withJets, use(P1, jets, "29013.propulsion-jets-action")),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, jets).exhausted).toBe(true);
      expect(inst(after, hero.mainScheme.instanceId).threat).toBe(9);
    });

    it("Version 3: exhausts and removes 3 threat from a scheme (equal to the version number)", () => {
      const hero = ironheartInHeroForm(2);
      const v3 = forceVersion(hero, P1, "29003a");
      const withThreat = patchInstance(v3, v3.mainScheme.instanceId, { threat: 10 });
      const { state: withJets, id: jets } = playFromHand(withThreat, "29013", 2);
      const after = settle(
        runWave5(withJets, use(P1, jets, "29013.propulsion-jets-action")),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, v3.mainScheme.instanceId).threat).toBe(7);
    });
  });

  describe("29020.r-and-d-facility-action", () => {
    it("exhausts, removes 1 research counter, and gives the chosen character +1 THW and +1 ATK until the end of the phase", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const before = characterProfile(hero, identity, WAVE5_DEPS)!;
      const { state: withFacility, id: facility } = playFromHand(hero, "29020", 3);
      expect(inst(withFacility, facility).counters.research).toBe(3);
      const after = settle(
        runWave5(withFacility, use(P1, facility, "29020.r-and-d-facility-action")),
        picking(identity),
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, facility).exhausted).toBe(true);
      expect(inst(after, facility).counters.research).toBe(2);
      const boosted = characterProfile(after, identity, WAVE5_DEPS)!;
      expect(boosted.thw).toBe(before.thw + 1);
      expect(boosted.atk).toBe(before.atk + 1);

      const endedPhase = settle(runWave5(after, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      const reverted = characterProfile(endedPhase, identity, WAVE5_DEPS)!;
      expect(reverted.thw).toBe(before.thw);
      expect(reverted.atk).toBe(before.atk);
    });
  });

  describe("29021.the-power-of-leadership-constant", () => {
    it("doubles the resources it generates while paying for a Leadership card", () => {
      const alterEgo = ironheartVsRhino();
      const given = moveToHand(alterEgo, P1, "29010", "29021"); // Ronnie Williams (leadership, cost 1) + Power of Leadership.
      const [ronnie, power] = given.ids as [InstanceId, InstanceId];
      // Power of Leadership alone (1 wild doubled to 2) covers Ronnie Williams's cost of 1 with no filler needed.
      const after = settle(runWave5(given.state, play(P1, ronnie, [power])), firstLegal, undefined, WAVE5_DEPS);
      expect(playerOf(after, P1).discard).toContain(power);
      expect(cardsInPlay(after)).toContain(ronnie);
    });
  });

  describe("29026.helicarrier-action", () => {
    it("exhausts, and reduces the cost of the chosen player's next card played this phase by 1", () => {
      const alterEgo = ironheartVsRhino();
      const { state: withHelicarrier, id: helicarrier } = playFromHand(alterEgo, "29026", 3);
      const afterUse = settle(
        runWave5(withHelicarrier, use(P1, helicarrier, "29026.helicarrier-action")),
        picking(P1),
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(afterUse, helicarrier).exhausted).toBe(true);
      const given = moveToHand(afterUse, P1, "29027"); // Ingenuity, cost 2.
      const [ingenuity] = given.ids as [InstanceId];
      const filler = payWith(given.state, P1, 1, [ingenuity]);
      const after = settle(runWave5(given.state, play(P1, ingenuity, filler)), firstLegal, undefined, WAVE5_DEPS);
      expect(cardsInPlay(after)).toContain(ingenuity);
    });
  });

  describe("29027.ingenuity-resource", () => {
    it("exhausts and generates a [mental] resource usable toward another card's cost", () => {
      const alterEgo = ironheartVsRhino();
      // Ingenuity's "Resource:" ability is used while paying for another card (Web-Shooter's own `resourceAbility`
      // precedent, `wave5/sm/spider-man-morales/support-upgrades-allies.test.ts`), so it must be in play first.
      const { state: withIngenuity, id: ingenuity } = playFromHand(alterEgo, "29027", 2);
      const given = moveToHand(withIngenuity, P1, "29010"); // Ronnie Williams, cost 1 (wild).
      const [ronnie] = given.ids as [InstanceId];
      const mental = resourceAbility(ingenuity, "29027.ingenuity-resource");
      const after = settle(
        runWave5(given.state, play(P1, ronnie, [], { abilities: [mental] })),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, ingenuity).exhausted).toBe(true);
      expect(cardsInPlay(after)).toContain(ronnie); // paid entirely by Ingenuity's generated resource.
    });
  });
});
