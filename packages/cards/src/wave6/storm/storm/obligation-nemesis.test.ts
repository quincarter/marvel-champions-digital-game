import { activeVillain, applyCommand, cardsInPlay, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../../testing/harness.js";
import {
  driveEventsPicking,
  encounterCardInVillainArea,
  revealFromEncounterDeck,
  stackSetAside,
  withForm,
} from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { STORM_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { stormGame } from "./support.js";

const ADVANCE = "01186";
const me = (state: GameState): InstanceId => identityOf(state, P1);
const heroGame = () => withForm(stormGame(), { heroForm: 0 });
const villainOf = (state: GameState) => activeVillain(state)!.instanceId;
/** Stunned skips an enemy's attack, confused its scheme (an enemy that still activates draws a boost card). */
const stun = (state: GameState, id: InstanceId, status: "stunned" | "confused" = "stunned") =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, [status]: 1 } });
const piles = (state: GameState) => Object.values(state.encounterDecks)[0]!;
const inPlay = (state: GameState, code: string): InstanceId | undefined =>
  instancesOf(state, code).find((id) => cardsInPlay(state).includes(id));
const resolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));
const useAbility = (state: GameState, id: InstanceId, abilityId: string) =>
  runWith(WAVE6_DEPS, state, {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: id,
    abilityId: abilityId as never,
    payment: [],
  });

/** A Knife Fight from the set-aside area on top of the encounter deck, Advance under it (surge's target). */
const knifeFightOnTop = (state: GameState) => stackEncounterDeck(stackSetAside(state, "36034"), "36034", ADVANCE);

/** Claustrophobia revealed in play on Ororo (alter-ego form) with the villain stunned. */
const claustrophobia = (form: "alterEgo" | "hero" = "alterEgo") => {
  const base = stun(form === "hero" ? heroGame() : stormGame(), villainOf(stormGame()));
  const state = settle(
    runWith(WAVE6_DEPS, stackEncounterDeck(base, ADVANCE, "36030"), endTurn(P1)),
    firstLegal,
    undefined,
    WAVE6_DEPS,
  );
  return { state, id: inPlay(state, "36030")! };
};
/** Storm (hero form unless `alterEgo`) with Callisto (stunned, so she stays out of the way) in play. */
const withCallisto = (alterEgo = false) => {
  const game = alterEgo ? stormGame() : heroGame();
  const status = alterEgo ? "confused" : "stunned";
  const base = stun(game, villainOf(game), status);
  const { state, id } = revealFromEncounterDeck(WAVE6_DEPS, base, "36031", firstLegal, 0);
  return { state: stun(stun(state, id, status), villainOf(state), status), callisto: id };
};

describe("Storm's obligation and nemesis set (36030-36034)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(STORM_OBLIGATION_NEMESIS).sort()).toEqual([
      "36030.claustrophobia-action",
      "36030.claustrophobia-constant",
      "36031.callisto-forced-interrupt",
      "36032.when-defeated",
      "36033.switchblade-constant",
      "36033.switchblade-constant-2",
      "36034.when-revealed-alter-ego",
      "36034.when-revealed-hero",
    ]);
    for (const definition of Object.values(STORM_OBLIGATION_NEMESIS))
      expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Claustrophobia (36030)", () => {
    it("is revealed into play and stays there", () => {
      const { state, id } = claustrophobia();
      expect(id).toBeDefined();
      expect(cardsInPlay(state)).toContain(id);
    });

    it("36030.claustrophobia-constant: while in alter-ego form she cannot change to hero form", () => {
      const { state } = claustrophobia();
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      expect(applyCommand(state, toHero(P1), WAVE6_DEPS).ok).toBe(false);
    });

    it("36030.claustrophobia-constant: without it she may change to hero form", () => {
      expect(applyCommand(stormGame(), toHero(P1), WAVE6_DEPS).ok).toBe(true);
    });

    it("36030.claustrophobia-action: exhaust Ororo Munroe removes Claustrophobia from the game", () => {
      const { state, id } = claustrophobia();
      const after = settle(useAbility(state, id, "36030.claustrophobia-action"), firstLegal, undefined, WAVE6_DEPS);
      expect(inst(after, me(after)).exhausted).toBe(true);
      expect(after.removedFromGame).toContain(id);
      expect(cardsInPlay(after)).not.toContain(id);
    });

    it("36030.claustrophobia-action: needs Ororo ready (the exhaust is a cost)", () => {
      const { state, id } = claustrophobia();
      const tired = patchInstance(state, me(state), { exhausted: true });
      const result = applyCommand(
        tired,
        {
          type: "useAbility",
          playerId: P1,
          cardInstanceId: id,
          abilityId: "36030.claustrophobia-action" as never,
          payment: [],
        },
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("Callisto (36031, nemesis minion)", () => {
    it("is revealed from the set-aside nemesis cards into play", () => {
      expect(withCallisto().callisto).toBeDefined();
    });

    it("36031.callisto-forced-interrupt: a Knife Fight revealed gives Callisto a tough status card", () => {
      // Alter-ego form: Knife Fight only surges, so the tough status card is not used up by its hero-form damage.
      const { state, callisto } = withCallisto(true);
      expect(inst(state, callisto).statuses.tough ?? 0).toBe(0);
      const { state: after, events } = driveEventsPicking(WAVE6_DEPS, knifeFightOnTop(state), firstLegal, endTurn(P1));
      expect(resolved(events)).toContain("36031.callisto-forced-interrupt");
      expect(inst(after, callisto).statuses.tough).toBe(1);
    });

    it("36031.callisto-forced-interrupt: another treachery does not", () => {
      const { state, callisto } = withCallisto();
      const { events } = driveEventsPicking(WAVE6_DEPS, stackEncounterDeck(state, ADVANCE), firstLegal, endTurn(P1));
      expect(resolved(events)).not.toContain("36031.callisto-forced-interrupt");
      expect(inst(state, callisto).statuses.tough ?? 0).toBe(0);
    });
  });

  describe("Leader of the Morlocks (36032)", () => {
    const defeat = (state: GameState) => {
      const scheme = encounterCardInVillainArea(state, "36032", 1);
      const ready = patchInstance(scheme.state, me(scheme.state), { exhausted: false });
      return driveEventsPicking(WAVE6_DEPS, ready, firstLegal, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: me(ready),
        schemeInstanceId: scheme.id,
      });
    };

    it("36032.when-defeated: the Knife Fight in the set-aside area is found and revealed", () => {
      const staged = stackSetAside(heroGame(), "36032");
      const setAside = playerOf(staged, P1).setAside.filter((i) => staged.instances[i]!.cardId === "36034");
      expect(setAside.length).toBeGreaterThan(0);
      const { state, events } = defeat(staged);
      expect(resolved(events)).toContain("36032.when-defeated");
      expect(resolved(events)).toContain("36034.when-revealed-hero");
      const left = playerOf(state, P1).setAside.filter((i) => state.instances[i]!.cardId === "36034");
      expect(left).toHaveLength(setAside.length - 1);
    });

    it("36032.when-defeated: a Knife Fight in the encounter deck is found there too", () => {
      // One copy moved into the encounter deck; the other stays set aside. The deck is searched first.
      const staged = stackSetAside(stackSetAside(heroGame(), "36032"), "36034");
      const deckCopy = instancesOf(staged, "36034").find((i) => piles(staged).deck.includes(i))!;
      const { state, events } = defeat(staged);
      expect(resolved(events)).toContain("36034.when-revealed-hero");
      expect(piles(state).deck).not.toContain(deckCopy);
      expect(piles(state).discard).toContain(deckCopy);
    });

    it("36032.when-defeated: with no Knife Fight left anywhere, nothing is revealed", () => {
      const staged = stackSetAside(heroGame(), "36032");
      const emptied = {
        ...staged,
        players: staged.players.map((p) => ({
          ...p,
          setAside: p.setAside.filter((i) => staged.instances[i]!.cardId !== "36034"),
        })),
      };
      const { events } = defeat(emptied);
      expect(resolved(events)).not.toContain("36034.when-revealed-hero");
    });
  });

  describe("Switchblade (36033)", () => {
    it("36033.switchblade-constant: attaches to the minion with the highest printed ATK", () => {
      const { state, callisto } = withCallisto();
      const { state: after, id } = revealFromEncounterDeck(WAVE6_DEPS, state, "36033", firstLegal, 0);
      expect(inst(after, callisto).attachments).toContain(id);
    });

    it("36033.switchblade-constant: gains surge when there is no minion to attach to", () => {
      const base = stun(heroGame(), villainOf(heroGame()));
      const staged = stackEncounterDeck(stackSetAside(base, "36033"), "36033", ADVANCE);
      const after = settle(runWith(WAVE6_DEPS, staged, endTurn(P1)), firstLegal, undefined, WAVE6_DEPS);
      expect(inPlay(after, "36033")).toBeUndefined();
      expect(piles(after).discard.some((i) => after.instances[i]!.cardId === ADVANCE)).toBe(true);
    });

    it("36033.switchblade-constant-2: the attached minion's attacks gain piercing", () => {
      expect(STORM_OBLIGATION_NEMESIS["36033.switchblade-constant-2"]?.trigger).toEqual({
        kind: "constant",
        rules: [{ kind: "attackKeywords", keywords: ["piercing"], attacker: { hostOfSelf: true } }],
      });
    });

    it("36033.switchblade-constant-2: piercing lets Callisto's attack through a tough status card", () => {
      const { state, callisto } = withCallisto();
      const { state: armed } = revealFromEncounterDeck(WAVE6_DEPS, state, "36033", firstLegal, 0);
      const toughHero = patchInstance(armed, me(armed), { statuses: { ...inst(armed, me(armed)).statuses, tough: 1 } });
      const ready = patchInstance(toughHero, callisto, { statuses: { stunned: 0, confused: 0, tough: 0 } });
      const { events } = driveEventsPicking(
        WAVE6_DEPS,
        stackEncounterDeck(ready, ADVANCE, ADVANCE),
        firstLegal,
        endTurn(P1),
      );
      const hits = events.filter((e) => e.type === "damageDealt" && e.targetInstanceId === me(ready));
      expect(hits.length).toBeGreaterThan(0);
    });
  });

  describe("Knife Fight (36034)", () => {
    it("36034.when-revealed-alter-ego: gains surge", () => {
      const base = stun(stormGame(), villainOf(stormGame()), "confused");
      const staged = knifeFightOnTop(base);
      const after = settle(runWith(WAVE6_DEPS, staged, endTurn(P1)), firstLegal, undefined, WAVE6_DEPS);
      expect(piles(after).discard.some((i) => after.instances[i]!.cardId === ADVANCE)).toBe(true);
    });

    it("36034.when-revealed-hero: you take damage equal to the highest-ATK enemy's ATK and it takes damage equal to your ATK", () => {
      // Callisto (ATK 3) outranks Rhino (ATK 2).
      const { state, callisto } = withCallisto();
      const before = inst(state, me(state)).damage;
      const { state: after, events } = driveEventsPicking(WAVE6_DEPS, knifeFightOnTop(state), firstLegal, endTurn(P1));
      expect(resolved(events)).toContain("36034.when-revealed-hero");
      expect(inst(after, me(after)).damage).toBe(before + 3);
      // The tough status card Callisto's interrupt gave her absorbed Storm's damage: it was Callisto that was hit.
      expect(resolved(events)).toContain("36031.callisto-forced-interrupt");
      expect(inst(after, callisto).statuses.tough).toBe(0);
      expect(inst(after, villainOf(after)).damage).toBe(inst(state, villainOf(state)).damage);
    });

    it("36034.when-revealed-hero: with only the villain in play, it is the chosen enemy", () => {
      const base = stun(heroGame(), villainOf(heroGame()));
      const before = inst(base, villainOf(base)).damage;
      const heroBefore = inst(base, me(base)).damage;
      const { state: after } = driveEventsPicking(WAVE6_DEPS, knifeFightOnTop(base), firstLegal, endTurn(P1));
      expect(inst(after, villainOf(after)).damage).toBeGreaterThan(before);
      expect(inst(after, me(after)).damage).toBeGreaterThan(heroBefore);
    });
  });
});
