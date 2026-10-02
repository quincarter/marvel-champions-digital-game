import { cardId, trait } from "@mc/content";
import {
  activeVillain,
  allyLimitFor,
  applyCommand,
  characterProfile,
  playCostOf,
  traitsOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  resourceAbility,
  runWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { moveToDiscard, playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { STORM_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { stormGame } from "./support.js";

const DEPS = WAVE6_DEPS;
const CLEAR_SKIES = "36002";
const THUNDERSTORM = "36004";

const REFS = [
  "36006.storms-crown-constant",
  "36006.storms-crown-resource",
  "36007.storms-cape-constant",
  "36007.storms-cape-response",
  "36008.ororos-garden-action",
  "36016.gentle-constant",
  "36017.pixie-response",
  "36018.uncanny-x-men-constant",
  "36019.leadership-skill-interrupt",
  "36020.to-me-my-x-men-action",
  "36021.effective-leadership-interrupt",
  "36022.forge-response",
  "36023.the-x-jet-resource",
  "36024.utopia-constant",
  "36024.utopia-response",
  "36025.x-mansion-action",
  "36026.endurance-constant",
  "36035.hangar-bay-response",
];

/** Picks, at each choice from the WEATHER deck, the card `codes` names next; anything else as `firstLegal`. */
const weatherPicks = (...codes: readonly string[]): Picker => {
  const wanted = [...codes];
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards") {
      const option = choice.options.find(
        (o) => o.ref.kind === "card" && state.instances[o.ref.instanceId]?.cardId === cardId(wanted[0] ?? ""),
      );
      if (option) {
        wanted.shift();
        return [option.optionId];
      }
    }
    return firstLegal(state);
  };
};
/** Storm in hero form with `code` as her WEATHER support in play. */
const stormWith = (code: string = CLEAR_SKIES): GameState =>
  withForm(stormGame("rhino", { seed: 1, pick: weatherPicks(code) }), { heroForm: 0 });
const heroId = (state: GameState) => identityOf(state, P1);
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, DEPS)!;
const one = (state: GameState, code: string): InstanceId => instancesOf(state, code)[0]!;
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const basicAttack = (attacker: InstanceId, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }) as never;
const attackWith = (state: GameState, attacker: InstanceId, target: InstanceId, pick: Picker = firstLegal) =>
  settle(runWith(DEPS, state, basicAttack(attacker, target)), pick, undefined, DEPS);
/** `code` played from hand (paying `cost`) into Storm's game. */
const withAlly = (state: GameState, code: string, cost: number, pick: Picker = firstLegal) => {
  const played = playFromHand(DEPS, state, code, cost, pick);
  return { state: played.state, id: played.id };
};
/** Tops the hand up to `n` cards from the deck, so a test can pay for what it plays. */
const fillHand = (state: GameState, n: number): GameState => ({
  ...state,
  players: state.players.map((p) => {
    if (p.playerId !== P1 || p.hand.length >= n) return p;
    const take = p.deck.slice(0, n - p.hand.length);
    return { ...p, hand: [...p.hand, ...take], deck: p.deck.slice(take.length) };
  }),
});
/** Test-only surgery: the first copy of `from` in the deck becomes a copy of `to`, a card the precon does not run. */
const relabeled = (state: GameState, from: string, to: string): GameState =>
  patchInstance(state, one(state, from), { cardId: cardId(to) });
const offers = (state: GameState, ability: string) =>
  state.pendingChoice?.options.some((o) => o.optionId.endsWith(`:${ability}`) || o.optionId === ability) ?? false;

/** Takes the card out of the hand and attaches it to `host` by surgery (no play, no cost). */
function attach(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}

describe("Storm's supports, upgrades and allies (36006-36008, 36014-36026, 36035)", () => {
  it("registers exactly the refs the card data names for them (Mirage aside), all valid", () => {
    expect(Object.keys(STORM_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...REFS].sort());
    for (const definition of Object.values(STORM_SUPPORT_UPGRADES_ALLIES)) {
      expect(validateDefinition(definition)).toEqual([]);
    }
  });

  describe("Storm's Crown (36006)", () => {
    it("36006.storms-crown-constant: Storm gets +1 THW as the hero, not in alter-ego form", () => {
      const base = stormWith();
      const thw = profile(base, heroId(base)).thw;
      const { state: armed } = attach(base, "36006", heroId(base));
      expect(profile(armed, heroId(armed)).thw).toBe(thw + 1);
      const alterBase = withForm(base, "alterEgo");
      const alter = withForm(armed, "alterEgo");
      expect(profile(alter, heroId(alter)).thw).toBe(profile(alterBase, heroId(alterBase)).thw);
    });

    it("36006.storms-crown-resource: generates the printed resource of her WEATHER support (Clear Skies: a wild one)", () => {
      const base = stormWith(CLEAR_SKIES);
      const { state: armed, id: crown } = attach(base, "36006", heroId(base));
      const given = moveToHand(armed, P1, "36008");
      const garden = given.ids[0]!;
      const handBefore = playerOf(given.state, P1).hand.length;
      const played = settle(
        runWith(
          DEPS,
          given.state,
          play(P1, garden, [], { abilities: [resourceAbility(crown, "36006.storms-crown-resource")] }),
        ),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(playerOf(played, P1).playArea).toContain(garden);
      expect(inst(played, crown).exhausted).toBe(true);
      expect(playerOf(played, P1).hand.length).toBe(handBefore - 1);
    });
  });

  describe("Storm's Cape (36007)", () => {
    it("36007.storms-cape-constant: +1 DEF and the AERIAL trait for her hero face only", () => {
      const base = stormWith();
      const def = profile(base, heroId(base)).def;
      const { state: armed } = attach(base, "36007", heroId(base));
      expect(profile(armed, heroId(armed)).def).toBe(def + 1);
      expect(traitsOf(base, heroId(base), DEPS)).not.toContain(trait("AERIAL"));
      expect(traitsOf(armed, heroId(armed), DEPS)).toContain(trait("AERIAL"));
      const alter = withForm(armed, "alterEgo");
      expect(traitsOf(alter, heroId(alter), DEPS)).not.toContain(trait("AERIAL"));
    });

    it("36007.storms-cape-response: after the Special of her WEATHER support resolves (Weather Goddess), exhausts to ready Storm", () => {
      const base = stormWith(THUNDERSTORM);
      const { state: armed, id: cape } = attach(base, "36007", heroId(base));
      const tired = patchInstance(armed, heroId(armed), { exhausted: true });
      const given = moveToHand(tired, P1, "36009");
      const goddess = given.ids[0]!;
      const cast = settle(
        runWith(DEPS, given.state, play(P1, goddess, payWith(given.state, P1, 0, [goddess]))),
        weatherPicks(CLEAR_SKIES),
        (s) => offers(s, "36007.storms-cape-response"),
        DEPS,
      );
      expect(offers(cast, "36007.storms-cape-response")).toBe(true);
      const done = settle(
        cast,
        (s) =>
          s
            .pendingChoice!.options.filter((o) => o.optionId.endsWith(":36007.storms-cape-response"))
            .map((o) => o.optionId),
        undefined,
        DEPS,
      );
      expect(inst(done, cape).exhausted).toBe(true);
      expect(inst(done, heroId(done)).exhausted).toBe(false);
    });
  });

  describe("Ororo's Garden (36008)", () => {
    it("36008.ororos-garden-action: in alter-ego form, exhausts to heal 2 damage from her identity", () => {
      const alter = withForm(stormWith(), "alterEgo");
      const hurt = patchInstance(alter, heroId(alter), { damage: 3 });
      const { state: staged } = playFromHand(DEPS, hurt, "36008", 1);
      const garden = one(staged, "36008");
      const used = settle(
        runWith(DEPS, staged, use(P1, garden, "36008.ororos-garden-action")),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(inst(used, heroId(used)).damage).toBe(1);
      expect(inst(used, garden).exhausted).toBe(true);
    });
  });

  describe("Gentle (36016)", () => {
    it("36016.gentle-constant: takes +1 consequential damage after attacking the villain, not a minion", () => {
      const { state: staged, id: gentle } = withAlly(stormWith(), "36016", 3);
      const vs = attackWith(staged, gentle, villainOf(staged));
      expect(inst(vs, gentle).damage).toBe(2);
      const { state: withMinion, id: minion } = engageMinion(staged, "01101", P1);
      const vsMinion = attackWith(withMinion, gentle, minion);
      expect(inst(vsMinion, gentle).damage).toBe(1);
    });
  });

  describe("Pixie (36017)", () => {
    it("36017.pixie-response: after you play her, adds an X-MEN ally from your discard pile to your hand", () => {
      const start = stormWith();
      const discarded = moveToDiscard(start, P1, "36014");
      const given = moveToHand(discarded.state, P1, "36017");
      const pixie = given.ids[0]!;
      const played = settle(
        runWith(DEPS, given.state, play(P1, pixie, payWith(given.state, P1, 2, [pixie]))),
        accepting("36017.pixie-response"),
        undefined,
        DEPS,
      );
      expect(playerOf(played, P1).playArea).toContain(pixie);
      expect(playerOf(played, P1).hand).toContain(discarded.id);
      expect(playerOf(played, P1).discard).not.toContain(discarded.id);
    });

    it("is not offered with no X-MEN ally in the discard pile", () => {
      const start = stormWith();
      const given = moveToHand(start, P1, "36017");
      const pixie = given.ids[0]!;
      const played = settle(
        runWith(DEPS, given.state, play(P1, pixie, payWith(given.state, P1, 2, [pixie]))),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(playerOf(played, P1).playArea).toContain(pixie);
      expect(played.pendingChoice).toBeFalsy();
    });
  });

  describe("Uncanny X-Men (36018)", () => {
    it("36018.uncanny-x-men-constant: X-MEN allies get +1 hit point, and cost 1 fewer while every character is X-MEN", () => {
      const { state: staged } = withAlly(fillHand(stormWith(), 8), "36018", 3);
      const given = moveToHand(fillHand(staged, 8), P1, "36016");
      const gentle = given.ids[0]!;
      expect(playCostOf(given.state, P1, gentle, DEPS)?.current).toBe(2); // printed 3
      const played = settle(
        runWith(DEPS, given.state, play(P1, gentle, payWith(given.state, P1, 2, [gentle]))),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(playerOf(played, P1).playArea).toContain(gentle);
      expect(profile(played, gentle).maxHp).toBe(4);
    });

    it("in alter-ego form (MUTANT, not X-MEN) the cost reduction does not apply, but the hit point does (Q31)", () => {
      const { state: staged } = withAlly(fillHand(stormWith(), 8), "36018", 3);
      const alter = withForm(staged, "alterEgo");
      const given = moveToHand(fillHand(alter, 8), P1, "36016");
      const gentle = given.ids[0]!;
      expect(playCostOf(given.state, P1, gentle, DEPS)?.current).toBe(3);
      const paid = settle(
        runWith(DEPS, given.state, play(P1, gentle, payWith(given.state, P1, 3, [gentle]))),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(profile(paid, gentle).maxHp).toBe(4);
    });

    it("Max 1 TEAM card per player: a second copy cannot be played", () => {
      const { state: staged } = withAlly(fillHand(stormWith(), 8), "36018", 3);
      const given = moveToHand(fillHand(staged, 8), P1, "36018");
      const second = given.ids[0]!;
      const command = play(P1, second, payWith(given.state, P1, 3, [second]));
      expect(applyCommand(given.state, command, DEPS).ok).toBe(false);
      // The same card with no copy in play is playable: the restriction, not the cost, refuses it.
      const fresh = moveToHand(fillHand(stormWith(), 8), P1, "36018");
      const first = fresh.ids[0]!;
      expect(applyCommand(fresh.state, play(P1, first, payWith(fresh.state, P1, 3, [first])), DEPS).ok).toBe(true);
    });
  });

  describe("Leadership Skill (36019)", () => {
    const armed = () => {
      const base = stormWith();
      const { state: withPixie, id: pixie } = withAlly(base, "36017", 2);
      const { state, id } = attach(withPixie, "36019", heroId(withPixie));
      return { state: patchInstance(state, id, { counters: { leadership: 3 } }), skill: id, pixie };
    };

    it("36019.leadership-skill-interrupt: an ally's basic attack gets +1 ATK for a counter", () => {
      const { state, skill, pixie } = armed();
      const villain = villainOf(state);
      const after = attackWith(state, pixie, villain, accepting("36019.leadership-skill-interrupt"));
      expect(inst(after, villain).damage - inst(state, villain).damage).toBe(3);
      expect(inst(after, skill).counters.leadership).toBe(2);
    });

    it("an ally's basic thwart gets +1 THW", () => {
      const { state, pixie } = armed();
      const threat = patchInstance(state, state.mainScheme.instanceId, { threat: 10 });
      const thwarted = settle(
        runWith(DEPS, threat, {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: pixie,
          schemeInstanceId: threat.mainScheme.instanceId,
        } as never),
        accepting("36019.leadership-skill-interrupt"),
        undefined,
        DEPS,
      );
      expect(10 - inst(thwarted, thwarted.mainScheme.instanceId).threat).toBe(2);
    });

    it("is not used by the hero's own basic attack", () => {
      const { state, skill } = armed();
      const villain = villainOf(state);
      const after = attackWith(state, heroId(state), villain, accepting("36019.leadership-skill-interrupt"));
      expect(inst(after, skill).counters.leadership).toBe(3);
    });
  });

  describe('"To Me, My X-Men!" (36020)', () => {
    const XMEN_ALLIES = ["36014", "36015", "36016", "36017", "36022"];
    const castEvent = (state: GameState, pick: Picker) => {
      const given = moveToHand(state, P1, "36020");
      const event = given.ids[0]!;
      return settle(
        runWith(DEPS, given.state, play(P1, event, payWith(given.state, P1, 1, [event]))),
        pick,
        undefined,
        DEPS,
      );
    };
    const picksCard =
      (id: InstanceId): Picker =>
      (state) => {
        const hit = state.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === id);
        return hit ? [hit.optionId] : firstLegal(state);
      };

    it("36020.to-me-my-x-men-action: puts the X-MEN ally from the top 5 into play, and adds it to your hand at the end of the phase", () => {
      const top = putOnTopOfDeck(stormWith(), P1, "36016");
      const gentle = top.ids[0]!;
      const cast = castEvent(top.state, picksCard(gentle));
      expect(playerOf(cast, P1).playArea).toContain(gentle);
      const phaseOver = settle(runWith(DEPS, cast, endTurn()), firstLegal, (s) => s.step.phase === "villain", DEPS);
      expect(playerOf(phaseOver, P1).hand).toContain(gentle);
      expect(playerOf(phaseOver, P1).playArea).not.toContain(gentle);
    });

    it("an ally no longer in play at the end of the phase is not added to the hand", () => {
      const top = putOnTopOfDeck(stormWith(), P1, "36016");
      const gentle = top.ids[0]!;
      const cast = castEvent(top.state, picksCard(gentle));
      const gone: GameState = {
        ...cast,
        players: cast.players.map((p) =>
          p.playerId === P1
            ? { ...p, playArea: p.playArea.filter((i) => i !== gentle), discard: [...p.discard, gentle] }
            : p,
        ),
      };
      const phaseOver = settle(runWith(DEPS, gone, endTurn()), firstLegal, (s) => s.step.phase === "villain", DEPS);
      expect(playerOf(phaseOver, P1).hand).not.toContain(gentle);
    });

    it("searches only the top 5: an X-MEN ally sixth from the top is not found", () => {
      const base = stormWith();
      const owner = playerOf(base, P1);
      const isAlly = (id: InstanceId) => XMEN_ALLIES.includes(base.instances[id]!.cardId as string);
      const gentle = owner.deck.find((id) => base.instances[id]!.cardId === cardId("36016"))!;
      const others = owner.deck.filter((id) => !isAlly(id));
      const rest = owner.deck.filter((id) => !others.slice(0, 5).includes(id) && id !== gentle);
      const arranged: GameState = {
        ...base,
        players: base.players.map((p) =>
          p.playerId === P1 ? { ...p, deck: [...others.slice(0, 5), gentle, ...rest] } : p,
        ),
      };
      const cast = castEvent(arranged, firstLegal);
      expect(playerOf(cast, P1).playArea).not.toContain(gentle);
      expect(playerOf(cast, P1).deck).toContain(gentle);
    });
  });

  describe("Forge (36022)", () => {
    const playForge = (state: GameState, pick: Picker) => {
      const given = moveToHand(state, P1, "36022");
      const forge = given.ids[0]!;
      return settle(
        runWith(DEPS, given.state, play(P1, forge, payWith(given.state, P1, 2, [forge]))),
        pick,
        undefined,
        DEPS,
      );
    };

    it("36022.forge-response: adds an X-MEN support from your deck to your hand", () => {
      const start = stormWith();
      const utopia = one(start, "36024");
      const played = playForge(start, (s) => {
        const choice = s.pendingChoice;
        const hit = choice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === utopia);
        return hit ? [hit.optionId] : accepting("36022.forge-response")(s);
      });
      expect(playerOf(played, P1).hand).toContain(utopia);
    });

    it("also finds one in your discard pile, and never offers a support with neither trait (Ororo's Garden)", () => {
      const start = stormWith();
      const discarded = moveToDiscard(start, P1, "36025");
      const garden = one(start, "36008");
      let sawGarden = false;
      const played = playForge(discarded.state, (s) => {
        const options = s.pendingChoice?.options ?? [];
        if (options.some((o) => o.ref.kind === "card" && o.ref.instanceId === garden)) sawGarden = true;
        const hit = options.find((o) => o.ref.kind === "card" && o.ref.instanceId === discarded.id);
        return hit ? [hit.optionId] : accepting("36022.forge-response")(s);
      });
      expect(sawGarden).toBe(false);
      expect(playerOf(played, P1).hand).toContain(discarded.id);
    });
  });

  describe("Hangar Bay (36035)", () => {
    const defended = (allyCode: string, cost: number) => {
      const bay = withAlly(relabeled(stormWith(), "36027", "36035"), "36035", 1);
      const { state: staged, id: ally } = withAlly(fillHand(bay.state, 8), allyCode, cost);
      // A boost card with no boost icon, so the villain's ATK is exactly its printed 2.
      const exhaustedAlly = stackEncounterDeck(staged, "01104");
      const toDefender = settle(
        runWith(DEPS, exhaustedAlly, endTurn()),
        firstLegal,
        (s) => s.pendingChoice?.prompt.kind === "declareDefender",
        DEPS,
      );
      const picked = answer(toDefender, [ally], DEPS);
      const offered: string[] = [];
      const after = settle(
        picked,
        (s) => {
          offered.push(...(s.pendingChoice?.options ?? []).map((o) => o.optionId));
          return accepting("36035.hangar-bay-response")(s);
        },
        (s) => s.step.phase !== "villain" || !s.pendingChoice,
        DEPS,
      );
      return { after, ally, bay: bay.id, offered };
    };

    it("36035.hangar-bay-response: after an ally defends and survives, exhausts to ready that ally", () => {
      const { after, ally, bay, offered } = defended("36016", 3);
      expect(offered.some((o) => o.endsWith("36035.hangar-bay-response"))).toBe(true);
      expect(inst(after, ally).exhausted).toBe(false);
      expect(inst(after, bay).exhausted).toBe(true);
    });

    it("is not used when the defending ally is defeated", () => {
      const { after, ally, bay, offered } = defended("36017", 2);
      expect(offered.some((o) => o.endsWith("36035.hangar-bay-response"))).toBe(false);
      expect(playerOf(after, P1).playArea).not.toContain(ally);
      expect(inst(after, bay).exhausted).toBe(false);
    });
  });

  describe("Reprints", () => {
    it("36023.the-x-jet-resource: generates a resource for an X-MEN hero", () => {
      const { state: staged, id: jet } = withAlly(stormWith(), "36023", 3);
      const given = moveToHand(staged, P1, "36008");
      const garden = given.ids[0]!;
      const played = settle(
        runWith(
          DEPS,
          given.state,
          play(P1, garden, [], { abilities: [resourceAbility(jet, "36023.the-x-jet-resource")] }),
        ),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(playerOf(played, P1).playArea).toContain(garden);
      expect(inst(played, jet).exhausted).toBe(true);
    });

    it("36024.utopia-response: after an X-MEN ally enters play, exhausts to ready an X-MEN character", () => {
      const { state: staged, id: utopia } = withAlly(stormWith(), "36024", 2);
      const tired = patchInstance(staged, heroId(staged), { exhausted: true });
      const given = moveToHand(tired, P1, "36016");
      const gentle = given.ids[0]!;
      const played = settle(
        runWith(DEPS, given.state, play(P1, gentle, payWith(given.state, P1, 3, [gentle]))),
        (s) => {
          const hero = s.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === heroId(s));
          return hero ? [hero.optionId] : accepting("36024.utopia-response")(s);
        },
        undefined,
        DEPS,
      );
      expect(inst(played, utopia).exhausted).toBe(true);
      expect(inst(played, heroId(played)).exhausted).toBe(false);
    });

    it("36024.utopia-constant: ally limit +1 while every ally is X-MEN", () => {
      const base = stormWith();
      expect(allyLimitFor(base, DEPS, P1)).toBe(3);
      const { state: staged } = withAlly(base, "36024", 2);
      expect(allyLimitFor(staged, DEPS, P1)).toBe(4);
    });

    it("36025.x-mansion-action: in alter-ego form, heals 1 damage from a MUTANT or X-MEN character", () => {
      const alter = withForm(stormWith(), "alterEgo");
      const hurt = patchInstance(alter, heroId(alter), { damage: 2 });
      const { state: staged, id: mansion } = withAlly(hurt, "36025", 2);
      const used = settle(
        runWith(DEPS, staged, use(P1, mansion, "36025.x-mansion-action")),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(inst(used, heroId(used)).damage).toBe(1);
    });

    it("36026.endurance-constant: you get +3 hit points", () => {
      const base = stormWith();
      const hp = profile(base, heroId(base)).maxHp;
      const { state: armed } = attach(base, "36026", heroId(base));
      expect(profile(armed, heroId(armed)).maxHp).toBe(hp + 3);
    });

    it("36021.effective-leadership-interrupt: an ally played with it gets +1 THW and +1 ATK until the end of the phase", () => {
      const given = moveToHand(fillHand(stormWith(), 8), P1, "36016", "36021");
      const [gentle, resource] = given.ids as [InstanceId, InstanceId];
      const played = settle(
        runWith(DEPS, given.state, play(P1, gentle, [resource, ...payWith(given.state, P1, 2, [gentle, resource])])),
        accepting("36021.effective-leadership-interrupt"),
        undefined,
        DEPS,
      );
      expect(profile(played, gentle).atk).toBe(4);
      expect(profile(played, gentle).thw).toBe(2);
    });
  });
});
