import { activeVillain, applyCommand, canAttack, cardsInPlay, type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import {
  driveEventsPicking,
  encounterCardInVillainArea,
  revealFromEncounterDeck,
  stackSetAside,
  stageNemesisCardForReveal,
  withForm,
} from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { CYCLOPS_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { cyclopsGame } from "./support.js";

const ADVANCE = "01186";
const VISOR = "33003";
const hero = (state: GameState) => identityOf(state, P1);
const heroGame = () => withForm(cyclopsGame(), { heroForm: 0 });
const villainOf = (state: GameState) => activeVillain(state)!.instanceId;
const stunVillain = (state: GameState) =>
  patchInstance(state, villainOf(state), { statuses: { ...inst(state, villainOf(state)).statuses, stunned: 1 } });
const pass = (state: GameState, pick: Picker = firstLegal) =>
  settle(runWith(WAVE6_DEPS, state, endTurn(P1)), pick, undefined, WAVE6_DEPS);
const encounterPiles = (state: GameState) => Object.values(state.encounterDecks)[0]!;
const resolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));

/**
 * Lost Visor is revealed from the encounter deck for real (the When Revealed search tucks Ruby Quartz Visor under it,
 * from the hand where this puts it); `withVisor: false` reveals it with no visor anywhere (cyclopsGame's deck has none).
 */
function lostVisorInPlay(state: GameState, withVisor: boolean) {
  let start = state;
  if (withVisor) start = moveToHand(start, P1, VISOR).state;
  const next = pass(stackEncounterDeck(start, ADVANCE, "33027"));
  const id = instancesOf(next, "33027").find((candidate) => cardsInPlay(next).includes(candidate))!;
  return { state: next, id, visor: inst(next, id).tucked?.[0] };
}

describe("Cyclops's obligation and nemesis set (33027-33031)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(CYCLOPS_OBLIGATION_NEMESIS).sort()).toEqual([
      "33027.lost-visor-action",
      "33027.lost-visor-constant",
      "33027.lost-visor-when-revealed",
      "33028.boost",
      "33029.when-defeated",
      "33030.gene-therapy-constant",
      "33030.gene-therapy-forced-interrupt",
      "33031.when-revealed-alter-ego",
      "33031.when-revealed-hero",
    ]);
    for (const definition of Object.values(CYCLOPS_OBLIGATION_NEMESIS))
      expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Lost Visor (33027)", () => {
    it("33027.lost-visor-when-revealed: tucks Ruby Quartz Visor from the hand facedown under Lost Visor", () => {
      const { state, id, visor } = lostVisorInPlay(cyclopsGame(), true);
      expect(visor).toBeDefined();
      expect(inst(state, visor!).cardId).toBe(VISOR);
      expect(playerOf(state, P1).hand).not.toContain(visor);
      expect(cardsInPlay(state)).toContain(id);
    });

    it("33027.lost-visor-constant: Cyclops cannot attack while it is in play", () => {
      const base = heroGame();
      const villain = villainOf(base);
      expect(canAttack(base, hero(base), villain, WAVE6_DEPS)).toBe(true);
      const { state } = lostVisorInPlay(base, true);
      expect(canAttack(state, hero(state), villain, WAVE6_DEPS)).toBe(false);
    });

    it("33027.lost-visor-action: exhaust Scott Summers, add the tucked Ruby Quartz Visor to your hand and remove Lost Visor from the game", () => {
      const { state, id, visor } = lostVisorInPlay(cyclopsGame(), true);
      const after = settle(
        runWith(WAVE6_DEPS, state, {
          type: "useAbility",
          playerId: P1,
          cardInstanceId: id,
          abilityId: "33027.lost-visor-action" as never,
          payment: [],
        }),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, hero(after)).exhausted).toBe(true);
      expect(playerOf(after, P1).hand).toContain(visor);
      expect(after.removedFromGame).toContain(id);
      expect(cardsInPlay(after)).not.toContain(id);
    });

    it("33027.lost-visor-action: needs Scott Summers ready (the exhaust is a cost)", () => {
      const { state, id } = lostVisorInPlay(cyclopsGame(), true);
      const tired = patchInstance(state, hero(state), { exhausted: true });
      const result = applyCommand(
        tired,
        {
          type: "useAbility",
          playerId: P1,
          cardInstanceId: id,
          abilityId: "33027.lost-visor-action" as never,
          payment: [],
        },
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
      expect(cardsInPlay(tired)).toContain(id);
    });
  });

  describe("Mister Sinister (33028, nemesis minion)", () => {
    it("is revealed from the set-aside nemesis cards into play", () => {
      const { state, id } = revealFromEncounterDeck(WAVE6_DEPS, heroGame(), "33028");
      expect(cardsInPlay(state)).toContain(id);
    });

    // As a boost card on the villain's attack: not stunned -> you are stunned.
    const boosted = (state: GameState) => pass(stackSetAside(state, "33028"));
    it("33028.boost: you are stunned", () => {
      const after = boosted(heroGame());
      expect(inst(after, hero(after)).statuses.stunned).toBe(1);
    });

    it("33028.boost: already stunned, you take 2 damage", () => {
      const open = heroGame();
      const stunned = patchInstance(open, hero(open), { statuses: { ...inst(open, hero(open)).statuses, stunned: 1 } });
      const control = boosted(open);
      const after = boosted(stunned);
      expect(inst(after, hero(after)).damage).toBe(inst(control, hero(control)).damage + 2);
    });
  });

  describe("Genetic Manipulation (33029) and Gene Therapy (33030)", () => {
    /** Gene Therapy is shuffled into the encounter deck once the nemesis set is in play (Core Shadow of the Past). */
    const withGeneTherapyInDeck = (state: GameState) => stackSetAside(stackSetAside(state, "33030"), "33029");

    it("33029.when-defeated: searching the encounter deck for Gene Therapy reveals it (it attaches to an enemy)", () => {
      const staged = withGeneTherapyInDeck(heroGame());
      const scheme = encounterCardInVillainArea(staged, "33029", 1);
      const ready = patchInstance(scheme.state, hero(scheme.state), { exhausted: false });
      const { state, events } = driveEventsPicking(WAVE6_DEPS, ready, firstLegal, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: hero(ready),
        schemeInstanceId: scheme.id,
      });
      expect(resolved(events)).toContain("33029.when-defeated");
      const [therapy] = instancesOf(state, "33030");
      expect(inst(state, therapy!).attachedTo).toBe(villainOf(state));
      expect(encounterPiles(state).deck).not.toContain(therapy);
    });

    it("33030.gene-therapy-constant: attaches to the enemy with the lowest printed ATK", () => {
      const { state, id } = revealFromEncounterDeck(WAVE6_DEPS, heroGame(), "33030");
      expect(inst(state, villainOf(state)).attachments).toContain(id);
    });

    it("33030.gene-therapy-constant: gains surge when every enemy already has a copy attached", () => {
      const { state: first } = revealFromEncounterDeck(WAVE6_DEPS, stunVillain(heroGame()), "33030", firstLegal, 0);
      const staged = stackEncounterDeck(stackSetAside(first, "33030"), ADVANCE);
      const villain = villainOf(staged);
      const second = pass(stunVillain(staged));
      expect(inst(second, villain).attachments.length).toBeLessThanOrEqual(1);
      // The second copy cannot attach and gains surge: the Advance behind it is revealed as well.
      expect(encounterPiles(second).discard.filter((i) => second.instances[i]!.cardId === ADVANCE)).toHaveLength(1);
    });

    it("33030.gene-therapy-forced-interrupt: the attached enemy's attack gains overkill and piercing, then Gene Therapy is discarded", () => {
      const { state: attached, id } = revealFromEncounterDeck(WAVE6_DEPS, heroGame(), "33030");
      const toughHero = patchInstance(attached, hero(attached), {
        statuses: { ...inst(attached, hero(attached)).statuses, tough: 2 },
      });
      const after = pass(stackEncounterDeck(toughHero, ADVANCE));
      expect(inst(after, hero(after)).statuses.tough).toBe(0);
      expect(encounterPiles(after).discard).toContain(id);
    });
  });

  describe("Concussive Force (33031)", () => {
    /**
     * Sinister is revealed first (the villain stunned so nothing else reveals), then Concussive Force is dealt as the
     * player's reveal: `fillers` Advance cards ahead of it absorb the boost cards of the enemies that activate that
     * phase (Advance as a boost is only icons); the deck behind it feeds the boost of the activation it causes.
     * The events are sliced from the card's own ability resolving, so earlier activations are not counted.
     */
    const sinisterOut = (state: GameState, fillers = 0) =>
      revealFromEncounterDeck(WAVE6_DEPS, stunVillain(state), "33028", firstLegal, fillers);
    const concussive = (state: GameState, ref: string, fillers: number) => {
      const staged = stageNemesisCardForReveal(state, "33031", P1, fillers);
      const { events } = driveEventsPicking(WAVE6_DEPS, staged, firstLegal, endTurn(P1));
      const at = events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === ref);
      expect(at).toBeGreaterThanOrEqual(0);
      return events.slice(at);
    };
    const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
      events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

    // An activation an effect starts is not an `enemyActivated` event; its attack / scheme resolving is.
    it("33031.when-revealed-alter-ego: with Mister Sinister in play, he schemes", () => {
      const { state, id } = sinisterOut(cyclopsGame(), 1);
      const after = concussive(state, "33031.when-revealed-alter-ego", 2);
      expect(of(after, "schemeResolved").map((e) => e.enemyInstanceId)).toEqual([id]);
    });

    it("33031.when-revealed-alter-ego: otherwise, 2 threat on the main scheme", () => {
      const after = concussive(cyclopsGame(), "33031.when-revealed-alter-ego", 1);
      expect(of(after, "schemeResolved")).toEqual([]);
      expect(of(after, "threatPlaced").map((e) => e.amount)).toEqual([2]);
    });

    it("33031.when-revealed-hero: with Mister Sinister in play, he attacks you", () => {
      const { state, id } = sinisterOut(heroGame());
      const after = concussive(state, "33031.when-revealed-hero", 2);
      expect(of(after, "attackResolved").map((e) => [e.enemyInstanceId, e.targetInstanceId])).toEqual([
        [id, hero(state)],
      ]);
    });

    it("33031.when-revealed-hero: otherwise, you take 2 damage", () => {
      const after = concussive(stunVillain(heroGame()), "33031.when-revealed-hero", 0);
      expect(of(after, "attackResolved")).toEqual([]);
      expect(of(after, "damageDealt").map((e) => e.amount)).toEqual([2]);
    });
  });
});
